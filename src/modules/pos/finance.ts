import { createHash, createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { posContext } from "@/modules/pos/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";
import { env } from "@/lib/config/env";
import {
  createStripeCheckout,
  createStripeRefund,
  PaymentProviderError,
  verifyStripeWebhook,
} from "./stripe";
import { getPool } from "@/db";
import { sendTransactionalEmail } from "@/lib/email";
import { validateTender } from "@/lib/pos/finance-math";

const key = z.string().uuid();
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const amount = z.string().regex(/^(0|[1-9][0-9]{0,9})$/);
const positive = amount.refine((v) => BigInt(v) > 0n, "Positive minor-unit amount required");
const reason = z.string().trim().min(5).max(200);
const customer = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    address: z.string().trim().min(5).max(500).optional(),
    taxRegistration: z.string().trim().min(3).max(64).optional(),
  })
  .strict();
const commands = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("profile"),
      key,
      data: z
        .object({
          mode: z.enum(["non_registered", "classified"]),
          expectedRevision: z.number().int().nonnegative(),
          inclusive: z.boolean(),
          taxLabel: z.string().trim().min(2).max(40),
          classes: z
            .array(
              z
                .object({
                  dishId: id,
                  classification: z.string().trim().min(1).max(32),
                  rateBps: z.number().int().min(0).max(10000),
                })
                .strict()
            )
            .max(1000),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("freeze"),
      key,
      data: z
        .object({
          saleId: id,
          expectedTotalMinor: amount,
          expectedTaxRevision: z.number().int().positive(),
          customer: customer.default({}),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("open_shift"),
      key,
      data: z
        .object({ registerName: z.string().trim().min(2).max(40), openingMinor: amount })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("cash_move"),
      key,
      data: z
        .object({ shiftId: id, direction: z.enum(["in", "out"]), amountMinor: positive, reason })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("tender"),
      key,
      data: z
        .object({
          saleId: id,
          shiftId: id,
          method: z.enum(["cash", "card_external", "upi_external", "bank_external"]),
          amountMinor: positive,
          tenderedMinor: positive,
          reference: z.string().trim().max(80).nullable(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("close_shift"),
      key,
      data: z.object({ shiftId: id, countedMinor: amount }).strict(),
    })
    .strict(),
  z.object({ action: z.literal("issue"), key, data: z.object({ saleId: id }).strict() }).strict(),
  z
    .object({
      action: z.literal("refund"),
      key,
      data: z
        .object({ saleId: id, shiftId: id, reason, externalRefundAttested: z.boolean() })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("staff_refund"),
      key,
      data: z
        .object({
          saleId: id,
          reason,
          externalRefundAttested: z.boolean(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("provider_checkout"),
      key,
      data: z.object({ saleId: id }).strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("partial_refund"),
      key,
      data: z
        .object({
          saleId: id,
          mode: z.enum(["staff_attested", "stripe"]),
          shiftId: id.nullable(),
          reason,
          externalRefundAttested: z.boolean(),
          lines: z
            .array(z.object({ lineId: id, quantity: z.number().int().positive() }).strict())
            .min(1)
            .max(100),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("deliver_document"),
      key,
      data: z.object({ documentId: id, email: z.email().max(254) }).strict(),
    })
    .strict(),
]);
export type FinanceCommand = z.infer<typeof commands>;
export type FinanceContext = {
  paymentsEnabled: boolean;
  documentsEnabled: boolean;
  fiscalApproved: boolean;
  providerEnabled: boolean;
  providerConfigured: boolean;
  documentDeliveryEnabled: boolean;
  jurisdictionPolicy: "non_registered_receipt_v1" | "registered_external_adapter_required_v1";
  taxProfile: null | {
    mode: "non_registered" | "classified";
    inclusive: boolean;
    taxLabel: string;
    revision: number;
    classes: Array<{ dishId: string; classification: string; rateBps: number }>;
  };
  canManage: boolean;
  canCollect: boolean;
  canRefund: boolean;
  canIssue: boolean;
};
export type LedgerRow = {
  saleId: string;
  orderId: string;
  currency: string;
  subtotalMinor: string;
  totalMinor: string | null;
  taxMinor: string | null;
  paidMinor: string;
  refundedMinor: string;
  documentNumber: string | null;
  createdAt: string;
};
export type ShiftRow = {
  id: string;
  registerName: string;
  state: "open" | "closed";
  actorId: string;
  openingMinor: string;
  expectedMinor: string | null;
  countedMinor: string | null;
  currency: string;
  openedAt: string;
  closedAt: string | null;
  cashTakenMinor: string;
  cashRefundMinor: string;
};
export type Detail = {
  saleId: string;
  orderId: string;
  currency: string;
  subtotalMinor: string;
  bill: null | {
    totalMinor: string;
    subtotalMinor: string;
    taxMinor: string;
    taxableBaseMinor: string;
    taxMode: string;
    taxProfileRevision: number;
    seller: Record<string, string | null>;
    customer: Record<string, string>;
    lines: Array<Record<string, string | number | null>>;
  };
  tenders: Array<{
    id: string;
    method: string;
    amountMinor: string;
    changeMinor: string;
    reference: string | null;
    evidence: string;
    shiftId: string | null;
    createdAt: string;
  }>;
  refunds: Array<{
    tenderId: string;
    amountMinor: string;
    reason: string;
    evidence?: string;
    createdAt: string;
  }>;
  documents: Array<{
    id: string;
    number: string;
    kind: string;
    sourceDocumentId: string | null;
    issuedAt: string;
  }>;
  providerAttempts: Array<{
    id: string;
    kind: "checkout" | "refund";
    state: "preparing" | "pending" | "succeeded" | "failed" | "uncertain";
    amountMinor: string;
    createdAt: string;
    updatedAt: string;
  }>;
  credits: Array<{
    id: string;
    state:
      | "prepared"
      | "staff_recorded"
      | "provider_pending"
      | "provider_confirmed"
      | "failed"
      | "uncertain";
    amountMinor: string;
    documentId: string | null;
    createdAt: string;
  }>;
};
export type DocumentDetail = {
  id: string;
  number: string;
  kind: string;
  issuedAt: string;
  sourceDocumentId: string | null;
  snapshot: {
    bill?: Detail["bill"];
    settlement?: Array<{
      method: string;
      amountMinor: string;
      reference: string | null;
      evidence: string;
    }>;
    orderId?: string;
    legalStatus: string;
    reverses?: string;
    reason?: string;
    totalMinor?: string;
  };
};
const queryTypes = z.discriminatedUnion("view", [
  z.object({ view: z.literal("context") }).strict(),
  z.object({ view: z.literal("ledger") }).strict(),
  z.object({ view: z.literal("shifts") }).strict(),
  z.object({ view: z.literal("reconcile") }).strict(),
  z.object({ view: z.literal("sale"), id }).strict(),
  z.object({ view: z.literal("settlement"), id }).strict(),
  z.object({ view: z.literal("document"), id }).strict(),
  z.object({ view: z.literal("preview"), id }).strict(),
]);
export type SettlementDetail = {
  saleId: string;
  orderId: string;
  currency: string;
  basis: "pre_tax_draft" | "frozen_bill";
  expectedMinor: string;
  staffAttestedMinor: string;
  staffMethod: string | null;
  financeTenderMinor: string;
  providerConfirmedMinor: string;
  cashCollectedMinor: string;
  refundMinor: string;
  cashRefundMinor: string;
  recordedNetMinor: string;
  unallocatedOriginalMinor: string;
  state: "unpaid" | "partial" | "paid" | "refunded" | "partially_refunded";
  orderPaymentStatus: string;
  staffEvidenceIsProviderConfirmed: false;
  providerReconciliationVerified: false;
  taxOrFiscalApprovalInferred: false;
};

export type FinanceView = z.infer<typeof queryTypes>;
function dbError(error: unknown): never {
  const e = error instanceof Error && error.cause ? error.cause : error;
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "42501")
    throw new ForbiddenError("Finance permission or operator activation required.");
  if (code === "40001" || code === "23505")
    throw new ConflictError("This financial record or request changed. Refresh and retry.");
  if (["22023", "22P02", "23503", "23514", "23502", "22003"].includes(code))
    throw new ValidationError("Invalid financial state, tax classification or command.");
  throw error;
}
async function run<T>(
  actor: Actor,
  outletId: string,
  statement: ReturnType<typeof sql>
): Promise<T> {
  try {
    return await withActor(actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
      const r = await tx.execute<{ result: T }>(statement);
      return r.rows[0]!.result;
    });
  } catch (error) {
    dbError(error);
  }
}
export async function financeRead(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  const input = queryTypes.parse(raw);
  await posContext(actor, organizationId, outletId);
  switch (input.view) {
    case "context":
      return {
        ...(await run<Omit<FinanceContext, "providerConfigured">>(
          actor,
          outletId,
          sql`select app_private.pos_finance_context(${outletId}) as result`
        )),
        providerConfigured: env.POS_STRIPE_ENABLED,
      };
    case "ledger":
      return run<LedgerRow[]>(
        actor,
        outletId,
        sql`select app_private.pos_ledger(${outletId}) as result`
      );
    case "shifts":
      return run<ShiftRow[]>(
        actor,
        outletId,
        sql`select app_private.pos_shift_list(${outletId}) as result`
      );
    case "reconcile":
      return run<{
        checkedAt: string;
        outletId: string;
        scanLimit: number;
        scannedCount: number;
        partial: boolean;
        anomalies: { saleId: string; reason: string }[];
      }>(actor, outletId, sql`select app_private.pos_reconciliation(${outletId}) as result`);
    case "settlement":
      return run<SettlementDetail>(
        actor,
        outletId,
        sql`select app_private.pos_settlement_detail(${outletId},${input.id}) as result`
      );
    case "sale":
      return run<Detail>(
        actor,
        outletId,
        sql`select app_private.pos_sale_detail(${outletId},${input.id}) as result`
      );
    case "document":
      return run<DocumentDetail>(
        actor,
        outletId,
        sql`select app_private.pos_document_detail(${outletId},${input.id}) as result`
      );
    case "preview":
      return run<Record<string, unknown>>(
        actor,
        outletId,
        sql`select app_private.pos_preview(${outletId},${input.id}) as result`
      );
  }
}
/** Command hashes exclude the idempotency key. The database holds one immutable result per outlet+key. */
export async function financeCommand(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<Record<string, unknown>> {
  const cmd = commands.parse(raw);
  await posContext(actor, organizationId, outletId);
  if (cmd.action === "staff_refund") {
    const payload = { action: cmd.action, data: cmd.data };
    const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return run<Record<string, unknown>>(
      actor,
      outletId,
      sql`select app_private.pos_staff_refund(
        ${outletId},${cmd.key},${hash},${cmd.data.saleId},
        ${cmd.data.reason},${cmd.data.externalRefundAttested}) as result`
    );
  }
  if (cmd.action === "provider_checkout")
    return providerCheckout(actor, outletId, cmd.key, cmd.data.saleId);
  if (cmd.action === "partial_refund") return partialRefund(actor, outletId, cmd.key, cmd.data);
  if (cmd.action === "deliver_document")
    return deliverDocument(actor, outletId, cmd.key, cmd.data.documentId, cmd.data.email);
  if (cmd.action === "profile") {
    if (cmd.data.mode === "non_registered" && cmd.data.classes.length)
      throw new ValidationError("Non-registered profile cannot classify taxable items.");
    if (cmd.data.mode === "classified" && !cmd.data.classes.length)
      throw new ValidationError("Classify every sale dish before billing.");
    if (new Set(cmd.data.classes.map((c) => c.dishId)).size !== cmd.data.classes.length)
      throw new ValidationError("Duplicate dish tax classification.");
  }
  if (cmd.action === "tender") {
    try {
      validateTender(cmd.data);
    } catch {
      throw new ValidationError("Tender amount, change or external reference is invalid.");
    }
  }
  const payload = { action: cmd.action, data: cmd.data };
  const digest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  // Replay is accessible for recovered successful commands without permitting a second capture.
  const old = await run<Record<string, unknown> | null>(
    actor,
    outletId,
    sql`select app_private.pos_finance_replay(${outletId},${cmd.key},${digest},${cmd.action}) as result`
  );
  if (old) return old;
  if (cmd.action === "profile")
    return run<Record<string, unknown>>(
      actor,
      outletId,
      sql`select app_private.pos_set_tax_profile(
   ${outletId},${cmd.key},${digest},${JSON.stringify(cmd.data)}::jsonb) as result`
    );
  return run<Record<string, unknown>>(
    actor,
    outletId,
    sql`select app_private.pos_finance_command(
  ${outletId},${cmd.key},${digest},${cmd.action},${JSON.stringify(cmd.data)}::jsonb) as result`
  );
}
export const financeCommandSchema = commands;

async function providerCheckout(
  actor: Actor,
  outletId: string,
  requestKey: string,
  saleId: string
) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ action: "provider_checkout", data: { saleId } }))
    .digest("hex");
  const prepared = await run<{
    attemptId: string;
    orderId: string;
    amountMinor: string;
    currency: string;
    state: string;
    checkoutUrl?: string | null;
  }>(
    actor,
    outletId,
    sql`select app_private.pos_provider_checkout_prepare(${outletId},${requestKey}::uuid,${digest},${saleId}) as result`
  );
  if (prepared.checkoutUrl || ["succeeded", "failed"].includes(prepared.state)) return prepared;
  try {
    const checkout = await createStripeCheckout({
      attemptId: prepared.attemptId,
      amountMinor: prepared.amountMinor,
      currency: prepared.currency,
      orderLabel: `MenuMinute order ${prepared.orderId.slice(0, 16)}`,
    });
    return run<Record<string, unknown>>(
      actor,
      outletId,
      sql`select app_private.pos_provider_attempt_result(${outletId},${prepared.attemptId},'pending',
        ${checkout.externalId},${checkout.externalPaymentId},${checkout.checkoutUrl},${checkout.expiresAt}::timestamptz) as result`
    );
  } catch (error) {
    const uncertain = error instanceof PaymentProviderError && error.uncertain;
    await run(
      actor,
      outletId,
      sql`select app_private.pos_provider_attempt_result(${outletId},${prepared.attemptId},
        ${uncertain ? "uncertain" : "failed"},${null},${null},${null},${null}::timestamptz) as result`
    );
    throw error;
  }
}

async function partialRefund(
  actor: Actor,
  outletId: string,
  requestKey: string,
  data: Extract<FinanceCommand, { action: "partial_refund" }>["data"]
) {
  if (new Set(data.lines.map((line) => line.lineId)).size !== data.lines.length)
    throw new ValidationError("Each refunded line may appear once per request.");
  if (data.mode === "staff_attested" && !data.shiftId)
    throw new ValidationError("An open shift is required for a staff-recorded refund.");
  if (data.mode === "stripe" && data.shiftId)
    throw new ValidationError("Provider refunds are not drawer movements.");
  const digest = createHash("sha256")
    .update(JSON.stringify({ action: "partial_refund", data }))
    .digest("hex");
  const prepared = await run<{
    attemptId?: string;
    creditId: string;
    amountMinor: string;
    currency: string;
    externalPaymentId?: string;
    state: string;
  }>(
    actor,
    outletId,
    sql`select app_private.pos_partial_refund_prepare(${outletId},${requestKey},${digest},
      ${JSON.stringify(data)}::jsonb) as result`
  );
  if (data.mode === "staff_attested" || !prepared.attemptId || !prepared.externalPaymentId)
    return prepared;
  try {
    const refund = await createStripeRefund({
      attemptId: prepared.attemptId,
      paymentIntentId: prepared.externalPaymentId,
      amountMinor: prepared.amountMinor,
    });
    await run(
      actor,
      outletId,
      sql`select app_private.pos_provider_attempt_external_result(${outletId},${prepared.attemptId},
       ${refund.state},${refund.externalId}) as result`
    );
    if (refund.state === "succeeded")
      return applyProviderEvent({
        eventId: `stripe-api-${refund.externalId}`,
        type: "refund.updated",
        attemptId: prepared.attemptId,
        externalId: refund.externalId,
        paymentId: refund.externalPaymentId,
        amountMinor: prepared.amountMinor,
        currency: prepared.currency,
        state: "succeeded",
      });
    return { ...prepared, externalId: refund.externalId, state: refund.state };
  } catch (error) {
    const uncertain = error instanceof PaymentProviderError && error.uncertain;
    await run(
      actor,
      outletId,
      sql`select app_private.pos_provider_attempt_external_result(${outletId},${prepared.attemptId},
       ${uncertain ? "uncertain" : "failed"},${null}) as result`
    );
    throw error;
  }
}

type ProviderEvent = {
  eventId: string;
  type: "checkout.completed" | "checkout.failed" | "refund.updated";
  attemptId: string;
  externalId: string;
  paymentId: string | null;
  amountMinor: string;
  currency: string;
  state: "pending" | "succeeded" | "failed";
};

async function applyProviderEvent(event: ProviderEvent) {
  const result = await getPool().query<{ result: Record<string, unknown> }>(
    `select app_private.pos_provider_event($1,$2,$3,$4,$5,$6::bigint,$7,$8) as result`,
    [
      event.eventId,
      event.type,
      event.attemptId,
      event.externalId,
      event.paymentId,
      event.amountMinor,
      event.currency,
      event.state,
    ]
  );
  return result.rows[0]!.result;
}

export async function applyStripeWebhook(body: Buffer, signature: string | null) {
  const event = verifyStripeWebhook(body, signature);
  const object = event.data.object;
  const metadata =
    object.metadata && typeof object.metadata === "object"
      ? (object.metadata as Record<string, unknown>)
      : {};
  const attemptId =
    typeof metadata.menuminute_attempt_id === "string"
      ? metadata.menuminute_attempt_id
      : typeof object.client_reference_id === "string"
        ? object.client_reference_id
        : "";
  if (!attemptId) throw new ValidationError("Provider event is missing its attempt identity.");
  if (event.type.startsWith("checkout.session.")) {
    const externalId = typeof object.id === "string" ? object.id : "";
    const paymentId = typeof object.payment_intent === "string" ? object.payment_intent : null;
    const amount = typeof object.amount_total === "number" ? object.amount_total : 0;
    const currency = typeof object.currency === "string" ? object.currency : "";
    const succeeded =
      (event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded") &&
      object.payment_status === "paid";
    return applyProviderEvent({
      eventId: event.id,
      type:
        event.type === "checkout.session.completed" || succeeded
          ? "checkout.completed"
          : "checkout.failed",
      attemptId,
      externalId,
      paymentId,
      amountMinor: String(amount),
      currency,
      state: succeeded
        ? "succeeded"
        : event.type === "checkout.session.completed"
          ? "pending"
          : "failed",
    });
  }
  const externalId = typeof object.id === "string" ? object.id : "";
  const paymentId = typeof object.payment_intent === "string" ? object.payment_intent : null;
  const amount = typeof object.amount === "number" ? object.amount : 0;
  const currency = typeof object.currency === "string" ? object.currency : "";
  const rawState = typeof object.status === "string" ? object.status : "";
  return applyProviderEvent({
    eventId: event.id,
    type: "refund.updated",
    attemptId,
    externalId,
    paymentId,
    amountMinor: String(amount),
    currency,
    state:
      rawState === "succeeded"
        ? "succeeded"
        : rawState === "failed" || rawState === "canceled" || event.type === "refund.failed"
          ? "failed"
          : "pending",
  });
}

async function deliverDocument(
  actor: Actor,
  outletId: string,
  requestKey: string,
  documentId: string,
  recipient: string
) {
  const normalizedRecipient = recipient.trim().toLowerCase();
  const recipientHash = createHmac("sha256", env.AUTH_SECRET)
    .update(normalizedRecipient)
    .digest("hex");
  const prepared = await run<{
    deliveryId: string;
    state: string;
    documentNumber?: string;
    kind?: string;
    snapshot?: Record<string, unknown>;
  }>(
    actor,
    outletId,
    sql`select app_private.pos_document_delivery_prepare(${outletId},${documentId},
      ${requestKey}::uuid,${recipientHash}) as result`
  );
  if (prepared.state === "sent" || !prepared.documentNumber || !prepared.snapshot) return prepared;
  const bill =
    prepared.snapshot.bill && typeof prepared.snapshot.bill === "object"
      ? (prepared.snapshot.bill as Record<string, unknown>)
      : null;
  const currency = typeof bill?.currency === "string" ? bill.currency : "";
  const total =
    typeof bill?.totalMinor === "string"
      ? bill.totalMinor
      : typeof prepared.snapshot.totalMinor === "string"
        ? prepared.snapshot.totalMinor
        : "";
  const text = [
    "MenuMinute private financial document",
    "",
    `Document: ${prepared.documentNumber}`,
    `Type: ${prepared.kind ?? "document"}`,
    currency && total ? `Recorded total: ${total} minor units (${currency})` : "",
    typeof prepared.snapshot.legalStatus === "string"
      ? `Status: ${prepared.snapshot.legalStatus}`
      : "",
    "",
    "This message is a delivery of the immutable merchant record. It is not proof of bank settlement or government fiscal registration.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    await sendTransactionalEmail({
      to: normalizedRecipient,
      subject: `MenuMinute document ${prepared.documentNumber}`,
      text,
    });
    return run<Record<string, unknown>>(
      actor,
      outletId,
      sql`select app_private.pos_document_delivery_result(${outletId},${prepared.deliveryId},'sent') as result`
    );
  } catch (error) {
    await run(
      actor,
      outletId,
      sql`select app_private.pos_document_delivery_result(${outletId},${prepared.deliveryId},'uncertain') as result`
    );
    throw error;
  }
}
