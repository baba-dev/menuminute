import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { commandMenu } from "../src/modules/menu-product/service";
import { posConfigure, posContext, posSubmit, posReceipt } from "../src/modules/pos/service";
import { financeRead, financeCommand } from "../src/modules/pos/finance";
import { getPool } from "../src/db";
import { withActor } from "../src/modules/tenancy/service";
import { reportQuerySchema } from "../src/modules/reports/contracts";
import { getReportsWorkspace, exportReportCsv } from "../src/modules/reports/service";

async function setup(
  mode: "non_registered" | "classified" = "non_registered",
  quantity = 1,
  staffPaid = false,
  paymentMethod: "cash" | "upi_external" = "cash"
) {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Finance fixture",
        currency: f.outlet.currency,
        categories: [
          {
            id: "lunch",
            name: "Lunch",
            items: [{ id: "plate", name: "Plate", priceMinor: 28000 }],
          },
        ],
      },
    },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  const context = await posContext(f.actor, f.outlet.organizationId, f.outlet.id);
  await posConfigure(f.actor, f.outlet.organizationId, f.outlet.id, {
    expectedRevision: context.revision,
    enabled: true,
    legalName: "Fixture Merchant",
    registeredAddress: "A real test seller address",
    country: "IN",
    taxRegime: mode === "classified" ? "requires_review" : "not_registered",
    taxRegistration: mode === "classified" ? "DEMO-REGISTRATION" : null,
  });
  const sale = await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, {
    key: crypto.randomUUID(),
    selection: {
      menuId,
      expectedRevision: 2,
      lines: [{ dishId: "plate", variantId: null, groups: [], quantity }],
    },
    fulfillmentMode: "dine_in",
    tableId: null,
    expectedSubtotalMinor: String(28000 * quantity),
    ...(staffPaid ? { markAsPaid: true, paymentMethod } : {}),
  });
  // Point of Sale now dispatches the order on the same transaction as sale creation.
  async function cmd(action: string, data: Record<string, unknown>, key = crypto.randomUUID()) {
    return financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, { action, key, data });
  }
  async function view(view: string, id?: string) {
    return financeRead(f.actor, f.outlet.organizationId, f.outlet.id, id ? { view, id } : { view });
  }
  return { ...f, menuId, sale, cmd, view };
}
async function operatorGate(
  outletId: string,
  orgId: string,
  fiscal = false,
  provider = false,
  delivery = false
) {
  await admin(async (_db, pool) =>
    pool.query(
      `insert into pos_finance_gates(outlet_id,organization_id,payments_enabled,documents_enabled,
       fiscal_approved,provider_enabled,document_delivery_enabled,approval_note)
   values($1,$2,true,true,$3,$4,$5,'isolated integration test only')`,
      [outletId, orgId, fiscal, provider, delivery]
    )
  );
}
describe("POS D–G real PostgreSQL finance integration", () => {
  it("defaults all live finance gates off, with denied direct ledger access", async () => {
    const f = await setup();
    expect(await f.view("context")).toMatchObject({
      paymentsEnabled: false,
      documentsEnabled: false,
      fiscalApproved: false,
    });
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    await expect(
      f.cmd("open_shift", { registerName: "counter", openingMinor: "0" })
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(getPool().query("select * from pos_tenders")).rejects.toThrow();
    await expect(
      getPool().query("update pos_finance_gates set payments_enabled=true")
    ).rejects.toThrow();
  });
  it("freezes one tax snapshot, accepts concurrent split manual tenders, issues a receipt and full credit", async () => {
    const f = await setup();
    await operatorGate(f.outlet.id, f.outlet.organizationId);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxMinor: string;
      taxProfileRevision: number;
    };
    expect(quote).toMatchObject({ totalMinor: "28000", taxMinor: "0" });
    const frozen = await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: { name: "Fixture Buyer" },
    });
    expect(frozen.frozen).toBe(true);
    await expect(
      f.cmd("freeze", {
        saleId: f.sale.saleId,
        expectedTotalMinor: quote.totalMinor,
        expectedTaxRevision: quote.taxProfileRevision,
        customer: {},
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const opened = (await f.cmd("open_shift", {
      registerName: "counter",
      openingMinor: "10000",
    })) as { shiftId: string };
    const auxiliary = (await f.cmd("open_shift", {
      registerName: "auxiliary",
      openingMinor: "500",
    })) as { shiftId: string };
    expect(auxiliary.shiftId).not.toBe(opened.shiftId);
    const firstCommand = {
      action: "tender",
      key: crypto.randomUUID(),
      data: {
        saleId: f.sale.saleId,
        shiftId: opened.shiftId,
        method: "cash",
        amountMinor: "10000",
        tenderedMinor: "20000",
        reference: null,
      },
    };
    const both = await Promise.all([
      financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, firstCommand),
      financeCommand(f.actor, f.outlet.organizationId, f.outlet.id, firstCommand),
    ]);
    expect(both[0]?.tenderId).toBe(both[1]?.tenderId);
    expect([both[0]?.duplicate ?? false, both[1]?.duplicate ?? false].sort()).toEqual([
      false,
      true,
    ]);
    expect(both[0]?.changeMinor).toBe("10000");
    await expect(
      f.cmd("tender", {
        saleId: f.sale.saleId,
        shiftId: opened.shiftId,
        method: "cash",
        amountMinor: "19000",
        tenderedMinor: "19000",
        reference: null,
      })
    ).rejects.toMatchObject({ statusCode: 409 });
    const paid = await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: opened.shiftId,
      method: "upi_external",
      amountMinor: "18000",
      tenderedMinor: "18000",
      reference: "staff-confirmed-reference",
    });
    expect(paid).toMatchObject({ remainingMinor: "0", status: "paid", evidence: "staff_recorded" });
    const detail = (await f.view("sale", f.sale.saleId)) as {
      bill: { totalMinor: string };
      tenders: unknown[];
      documents: unknown[];
    };
    expect(detail.tenders).toHaveLength(2);
    expect(detail.bill.totalMinor).toBe("28000");
    const issued = (await f.cmd("issue", { saleId: f.sale.saleId })) as {
      documentId: string;
      documentNumber: string;
      kind: string;
    };
    expect(issued.kind).toBe("receipt");
    const printable = (await f.view("document", issued.documentId)) as {
      number: string;
      snapshot: { bill: { totalMinor: string } };
    };
    expect(printable.number).toBe(issued.documentNumber);
    expect(printable.snapshot.bill.totalMinor).toBe("28000");
    const refunded = (await f.cmd("refund", {
      saleId: f.sale.saleId,
      shiftId: opened.shiftId,
      reason: "Customer received full reversal",
      externalRefundAttested: true,
    })) as { kind: string; refundedMinor: string };
    expect(refunded).toMatchObject({ kind: "credit_note", refundedMinor: "28000" });
    const closing = (await f.cmd("close_shift", {
      shiftId: opened.shiftId,
      countedMinor: "10000",
    })) as { expectedMinor: string; varianceMinor: string };
    // Opening 10000 + applied cash 10000 - fully reversed cash 10000.
    expect(closing).toMatchObject({ expectedMinor: "10000", varianceMinor: "0" });
    const registers = (await f.view("shifts")) as unknown as Array<{ id: string; state: string }>;
    expect(registers.find((s) => s.id === opened.shiftId)?.state).toBe("closed");
    expect(registers.find((s) => s.id === auxiliary.shiftId)?.state).toBe("open");
    const reconciliation = (await f.view("reconcile")) as {
      anomalies: unknown[];
      scanLimit: number;
      scannedCount: number;
      partial: boolean;
    };
    expect(reconciliation.anomalies).toEqual([]);
    expect(reconciliation).toMatchObject({ scanLimit: 500, scannedCount: 1, partial: false });
    const docs = await admin(async (_db, pool) =>
      pool.query(
        "select kind,document_number,source_document_id from pos_documents where sale_id=$1 order by issued_at",
        [f.sale.saleId]
      )
    );
    expect(docs.rowCount).toBe(2);
    await expect(getPool().query("delete from pos_documents")).rejects.toThrow();
  });
  it("uses classified line tax rounding and denies fiscal invoice issuance until operator approved", async () => {
    const f = await setup("classified");
    await operatorGate(f.outlet.id, f.outlet.organizationId, false);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "classified",
      inclusive: false,
      taxLabel: "Test tax",
      classes: [{ dishId: "plate", classification: "EXAMPLE", rateBps: 500 }],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxMinor: string;
      taxProfileRevision: number;
    };
    expect(quote).toMatchObject({ totalMinor: "29400", taxMinor: "1400" });
    await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: {},
    });
    // Changing merchant rates after a successful freeze must never alter
    // the permanent tax/line snapshot or its eventual document.
    await f.cmd("profile", {
      expectedRevision: 1,
      mode: "classified",
      inclusive: false,
      taxLabel: "Changed tax",
      classes: [{ dishId: "plate", classification: "CHANGED", rateBps: 1000 }],
    });
    const locked = (await f.view("sale", f.sale.saleId)) as {
      bill: { totalMinor: string; taxMinor: string; taxProfileRevision: number };
    };
    expect(locked.bill).toMatchObject({
      totalMinor: "29400",
      taxMinor: "1400",
      taxProfileRevision: 1,
    });
    const order = await admin(async (_db, pool) =>
      pool.query("select subtotal_minor,tax_minor,total_minor from orders where id=$1", [
        f.sale.orderId,
      ])
    );
    expect(order.rows[0]).toMatchObject({
      subtotal_minor: 28000,
      tax_minor: 1400,
      total_minor: 29400,
    });
    const shift = (await f.cmd("open_shift", { registerName: "counter", openingMinor: "0" })) as {
      shiftId: string;
    };
    await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: shift.shiftId,
      method: "cash",
      amountMinor: "29400",
      tenderedMinor: "29400",
      reference: null,
    });
    await expect(f.cmd("issue", { saleId: f.sale.saleId })).rejects.toMatchObject({
      statusCode: 403,
    });
    await admin(async (_db, pool) =>
      pool.query("update pos_finance_gates set fiscal_approved=true where outlet_id=$1", [
        f.outlet.id,
      ])
    );
    // A gate is operational approval, not a jurisdiction implementation. Generic registered
    // invoices stay fail-closed until a separately reviewed statutory adapter is installed.
    await expect(f.cmd("issue", { saleId: f.sale.saleId })).rejects.toMatchObject({
      statusCode: 403,
    });
    const other = await fixture();
    await expect(
      financeRead(f.actor, other.outlet.organizationId, other.outlet.id, { view: "ledger" })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it("allocates line-level partial refunds once and links each credit note to its source", async () => {
    const f = await setup("non_registered", 2);
    await operatorGate(f.outlet.id, f.outlet.organizationId);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxProfileRevision: number;
    };
    await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: {},
    });
    const shift = (await f.cmd("open_shift", {
      registerName: "returns",
      openingMinor: "0",
    })) as { shiftId: string };
    await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: shift.shiftId,
      method: "cash",
      amountMinor: quote.totalMinor,
      tenderedMinor: quote.totalMinor,
      reference: null,
    });
    const source = (await f.cmd("issue", { saleId: f.sale.saleId })) as {
      documentId: string;
    };
    const detail = (await f.view("sale", f.sale.saleId)) as {
      bill: { lines: Array<{ id: string }> };
    };
    const lineId = detail.bill.lines[0]!.id;
    const key = crypto.randomUUID();
    const command = {
      saleId: f.sale.saleId,
      mode: "staff_attested",
      shiftId: shift.shiftId,
      reason: "One of two plates was returned",
      externalRefundAttested: false,
      lines: [{ lineId, quantity: 1 }],
    };
    const first = await f.cmd("partial_refund", command, key);
    const replay = await f.cmd("partial_refund", command, key);
    expect(first).toMatchObject({ refundedMinor: "28000", state: "staff_recorded" });
    expect(replay).toMatchObject({ refundedMinor: "28000", duplicate: true });
    const second = await f.cmd("partial_refund", command);
    expect(second).toMatchObject({ refundedMinor: "28000", state: "staff_recorded" });
    await expect(f.cmd("partial_refund", command)).rejects.toMatchObject({ statusCode: 409 });
    const documents = await admin(async (_db, pool) =>
      pool.query(
        "select kind,source_document_id from pos_documents where outlet_id=$1 and sale_id=$2 order by issued_at",
        [f.outlet.id, f.sale.saleId]
      )
    );
    expect(documents.rows).toEqual([
      { kind: "receipt", source_document_id: null },
      { kind: "credit_note", source_document_id: source.documentId },
      { kind: "credit_note", source_document_id: source.documentId },
    ]);
    const reconciliation = (await f.view("reconcile")) as { anomalies: unknown[] };
    expect(reconciliation.anomalies).toEqual([]);
  });
  it("reconciles concurrent provider confirmations into exactly one verified tender", async () => {
    const f = await setup();
    await operatorGate(f.outlet.id, f.outlet.organizationId, false, true);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "non_registered",
      inclusive: false,
      taxLabel: "No tax",
      classes: [],
    });
    const quote = (await f.view("preview", f.sale.saleId)) as {
      totalMinor: string;
      taxProfileRevision: number;
    };
    await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: {},
    });
    const requestKey = crypto.randomUUID();
    const prepared = await withActor(f.actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${f.outlet.id},true)`);
      const row = await tx.execute<{ result: { attemptId: string } }>(
        sql`select app_private.pos_provider_checkout_prepare(
          ${f.outlet.id},${requestKey}::uuid,${"a".repeat(64)},${f.sale.saleId}
        ) as result`
      );
      return row.rows[0]!.result;
    });
    await withActor(f.actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${f.outlet.id},true)`);
      await tx.execute(sql`select app_private.pos_provider_attempt_result(
        ${f.outlet.id},${prepared.attemptId},'pending','cs_test_contract123',
        'pi_contract123','https://checkout.stripe.com/c/pay/cs_test_contract123',null
      )`);
    });
    const eventArgs = [
      "evt_concurrent_contract123",
      "checkout.completed",
      prepared.attemptId,
      "cs_test_contract123",
      "pi_contract123",
      quote.totalMinor,
      f.outlet.currency,
      "succeeded",
    ];
    const confirmations = await Promise.all(
      [0, 1].map(() =>
        getPool().query<{ result: { duplicate?: boolean } }>(
          "select app_private.pos_provider_event($1,$2,$3,$4,$5,$6::bigint,$7,$8) as result",
          eventArgs
        )
      )
    );
    expect(confirmations.filter((result) => result.rows[0]!.result.duplicate)).toHaveLength(1);
    const detail = (await f.view("sale", f.sale.saleId)) as {
      tenders: Array<{ evidence: string; method: string }>;
      providerAttempts: Array<{ state: string }>;
    };
    expect(detail.tenders).toEqual([
      expect.objectContaining({ method: "stripe_checkout", evidence: "provider_confirmed" }),
    ]);
    expect(detail.providerAttempts).toEqual([expect.objectContaining({ state: "succeeded" })]);
    const reconciliation = (await f.view("reconcile")) as { anomalies: unknown[] };
    expect(reconciliation.anomalies).toEqual([]);
  });
});

describe("POS #142 B/D shared settlement and manager corrections", () => {
  it("shows unpaid draft as distinct from provider-confirmed finance", async () => {
    const f = await setup();
    const detail = (await f.view("settlement", f.sale.saleId)) as {
      basis: string;
      state: string;
      expectedMinor: string;
      staffAttestedMinor: string;
      providerConfirmedMinor: string;
      financeTenderMinor: string;
      refundMinor: string;
    };
    expect(detail).toMatchObject({
      basis: "pre_tax_draft",
      state: "unpaid",
      expectedMinor: "28000",
      staffAttestedMinor: "0",
      providerConfirmedMinor: "0",
      financeTenderMinor: "0",
      refundMinor: "0",
    });
    await expect(getPool().query("select * from pos_staff_refunds")).rejects.toThrow();
  });

  it("corrects complete staff-paid cash order without finance activation, once", async () => {
    const f = await setup("non_registered", 1, true);
    expect(await f.view("context")).toMatchObject({ paymentsEnabled: false });
    const before = (await f.view("settlement", f.sale.saleId)) as Record<string, unknown>;
    const ledgerBefore = (await f.view("ledger")) as unknown as Array<{
      saleId: string;
      paidMinor: string;
      refundedMinor: string;
      paymentEvidence: string;
    }>;
    expect(ledgerBefore.find((row) => row.saleId === f.sale.saleId)).toMatchObject({
      paidMinor: "28000",
      refundedMinor: "0",
      paymentEvidence: "staff_recorded",
    });
    expect(before).toMatchObject({
      state: "paid",
      staffAttestedMinor: "28000",
      providerConfirmedMinor: "0",
      cashCollectedMinor: "28000",
      refundMinor: "0",
      recordedNetMinor: "28000",
    });
    const data = {
      saleId: f.sale.saleId,
      reason: "Wrong customer payment",
      externalRefundAttested: false,
    };
    const key = crypto.randomUUID();
    const first = await f.cmd("staff_refund", data, key);
    const again = await f.cmd("staff_refund", data, key);
    expect(first).toMatchObject({
      state: "staff_refunded",
      amountMinor: "28000",
      duplicate: false,
    });
    expect(again).toMatchObject({ state: "staff_refunded", amountMinor: "28000", duplicate: true });
    await expect(f.cmd("staff_refund", data)).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      f.cmd("staff_refund", { ...data, reason: "Changed reason for prior key" }, key)
    ).rejects.toMatchObject({ statusCode: 409 });
    const after = (await f.view("settlement", f.sale.saleId)) as Record<string, unknown>;
    const ledgerAfter = (await f.view("ledger")) as unknown as Array<{
      saleId: string;
      paidMinor: string;
      refundedMinor: string;
      staffRefunded: boolean;
    }>;
    expect(ledgerAfter.find((row) => row.saleId === f.sale.saleId)).toMatchObject({
      paidMinor: "28000",
      refundedMinor: "28000",
      staffRefunded: true,
    });
    expect(after).toMatchObject({
      state: "refunded",
      staffAttestedMinor: "28000",
      staffRefundMinor: "28000",
      refundMinor: "28000",
      recordedNetMinor: "0",
      cashRefundMinor: "28000",
      orderPaymentStatus: "voided",
    });
    const receipt = await posReceipt(f.actor, f.outlet.organizationId, f.outlet.id, f.sale.saleId);
    expect(receipt).toMatchObject({ paymentStatus: "refunded", refundRecorded: true });
    const rows = await admin(async (_db, pool) =>
      pool.query("select count(*)::int as count from pos_staff_refunds where sale_id=$1", [
        f.sale.saleId,
      ])
    );
    expect(rows.rows[0]?.count).toBe(1);
  });

  it("requires an explicit external refund attestation and rejects wrong outlet", async () => {
    const f = await setup("non_registered", 1, true, "upi_external");
    const data = {
      saleId: f.sale.saleId,
      reason: "External UPI was returned",
      externalRefundAttested: false,
    };
    await expect(f.cmd("staff_refund", data)).rejects.toThrow();
    const other = await fixture();
    await expect(
      financeRead(f.actor, other.outlet.organizationId, other.outlet.id, {
        view: "settlement",
        id: f.sale.saleId,
      })
    ).rejects.toThrow();
    const corrected = await f.cmd("staff_refund", { ...data, externalRefundAttested: true });
    expect(corrected).toMatchObject({ state: "staff_refunded", amountMinor: "28000" });
    const after = (await f.view("settlement", f.sale.saleId)) as Record<string, unknown>;
    expect(after).toMatchObject({
      state: "refunded",
      cashRefundMinor: "0",
      staffMethod: "upi_external",
    });
  });

  it("serializes two separate refund attempts to exactly one compensation", async () => {
    const f = await setup("non_registered", 1, true);
    const data = {
      saleId: f.sale.saleId,
      reason: "Duplicate register correction",
      externalRefundAttested: false,
    };
    const attempts = await Promise.allSettled([
      f.cmd("staff_refund", data),
      f.cmd("staff_refund", data),
    ]);
    expect(attempts.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const rows = await admin(async (_db, pool) =>
      pool.query("select count(*)::int as count from pos_staff_refunds where sale_id=$1", [
        f.sale.saleId,
      ])
    );
    expect(rows.rows[0]?.count).toBe(1);
  });
});

describe("POS #142 F/G merchant reporting and paged reconciliation", () => {
  it("scans every sale with bounded non-overlapping cursor pages", async () => {
    const f = await setup();
    for (let i = 0; i < 4; i++) {
      await posSubmit(f.actor, f.outlet.organizationId, f.outlet.id, {
        key: crypto.randomUUID(),
        selection: {
          menuId: f.menuId,
          expectedRevision: 2,
          lines: [{ dishId: "plate", variantId: null, groups: [], quantity: 1 }],
        },
        fulfillmentMode: "dine_in",
        tableId: null,
        expectedSubtotalMinor: "28000",
      });
    }
    async function page(mode: "ledger" | "reconcile", at: string | null, id: string | null) {
      return withActor(f.actor, async (tx) => {
        await tx.execute(sql`select set_config('app.outlet_id',${f.outlet.id},true)`);
        const query =
          mode === "ledger"
            ? sql`select app_private.pos_ledger_page(${f.outlet.id},
            ${at}::timestamptz,${id},2) as data`
            : sql`select app_private.pos_reconciliation_page(${f.outlet.id},
            ${at}::timestamptz,${id},2) as data`;
        const r = await tx.execute<{
          data: {
            items?: Array<{ saleId: string }>;
            scannedCount?: number;
            hasMore: boolean;
            nextCursorAt: string | null;
            nextCursorId: string | null;
            anomalies?: Array<{ reason: string }>;
          };
        }>(query);
        return r.rows[0]!.data;
      });
    }
    for (const mode of ["ledger", "reconcile"] as const) {
      let at: string | null = null;
      let id: string | null = null;
      let total = 0;
      const seen = new Set<string>();
      for (let iteration = 0; iteration < 5; iteration++) {
        const part = await page(mode, at, id);
        total += mode === "ledger" ? (part.items?.length ?? 0) : (part.scannedCount ?? 0);
        if (mode === "ledger") {
          for (const item of part.items ?? []) {
            expect(seen.has(item.saleId)).toBe(false);
            seen.add(item.saleId);
          }
        } else expect(part.anomalies).toEqual([]);
        if (!part.hasMore) break;
        expect(part.nextCursorAt).toBeTruthy();
        at = part.nextCursorAt;
        id = part.nextCursorId;
      }
      expect(total).toBe(5);
    }
    await expect(getPool().query("select * from pos_staff_refunds")).rejects.toThrow();
  });

  it("reconciles Reports with staff-attested sales and corrections without a shift", async () => {
    const f = await setup("non_registered", 1, true);
    const query = reportQuerySchema.parse({ tab: "till" });
    const before = await getReportsWorkspace(f.actor, f.outlet.id, query);
    expect(before.tillReconciliation).toMatchObject({
      available: true,
      totalCollectedMinor: 28000,
      totalRefundedMinor: 0,
      staffCollectedMinor: 28000,
      unassignedNetCashMinor: 28000,
      bankReconciliationVerified: false,
    });
    await f.cmd("staff_refund", {
      saleId: f.sale.saleId,
      reason: "Cash refunded to customer",
      externalRefundAttested: false,
    });
    const after = await getReportsWorkspace(f.actor, f.outlet.id, query);
    expect(after.tillReconciliation).toMatchObject({
      totalCollectedMinor: 28000,
      totalRefundedMinor: 28000,
      staffRefundedMinor: 28000,
      unassignedNetCashMinor: 0,
      netCashFlowMinor: 0,
    });
    const exported = await exportReportCsv(f.actor, f.outlet.id, "till", query);
    expect(exported.content).toContain("staff_attested_collections");
    expect(exported.content).toContain("staff_attested_refunds");
    expect(exported.content).toContain("unassigned_net_cash_not_in_drawers");
    expect(exported.content).toContain("Not bank reconciled");
    const ledger = (await f.view("ledger")) as unknown as Array<{
      saleId: string;
      paidMinor: string;
      refundedMinor: string;
    }>;
    expect(ledger.find((x) => x.saleId === f.sale.saleId)).toMatchObject({
      paidMinor: "28000",
      refundedMinor: "28000",
    });
  });
});


describe("POS #142 E: protected fiscal diagnostic does not issue registered invoices", () => {
  it("shows missing jurisdiction/IRP requirements on the real frozen bill", async () => {
    const f = await setup("classified");
    await operatorGate(f.outlet.id, f.outlet.organizationId, true);
    await f.cmd("profile", {
      expectedRevision: 0,
      mode: "classified",
      inclusive: false,
      taxLabel: "Review-only GST fixture",
      classes: [{ dishId: "plate", classification: "EXAMPLE", rateBps: 500 }],
    });
    const quote = await f.view("preview", f.sale.saleId) as {
      totalMinor: string; taxProfileRevision: number;
    };
    await f.cmd("freeze", {
      saleId: f.sale.saleId,
      expectedTotalMinor: quote.totalMinor,
      expectedTaxRevision: quote.taxProfileRevision,
      customer: { name: "Test buyer", address: "Test delivery address" },
    });
    const shift = await f.cmd("open_shift", {
      registerName: "fiscal fixture",
      openingMinor: "0",
    }) as { shiftId: string };
    await f.cmd("tender", {
      saleId: f.sale.saleId,
      shiftId: shift.shiftId,
      method: "cash",
      amountMinor: quote.totalMinor,
      tenderedMinor: quote.totalMinor,
      reference: null,
    });
    const readiness = await f.view("fiscal_readiness", f.sale.saleId) as unknown as {
      statutoryIssuanceAllowed: boolean; failedCount: number;
      checks: Array<{id:string;satisfied:boolean}>;
    };
    expect(readiness.statutoryIssuanceAllowed).toBe(false);
    expect(readiness.failedCount).toBeGreaterThan(0);
    expect(readiness.checks.find((v) => v.id === "external")?.satisfied).toBe(false);
    await expect(f.cmd("issue", { saleId: f.sale.saleId })).rejects.toMatchObject({
      statusCode: 403,
    });
    const rows = await admin(async (_db, pool) =>
      pool.query("select count(*)::int as n from pos_documents where outlet_id=$1 and kind='invoice'",
        [f.outlet.id])
    );
    expect(rows.rows[0]?.n).toBe(0);
  });

  it("cannot read another merchant's fiscal bill or issue invoice through SQL grants", async () => {
    const f = await setup("classified");
    const another = await fixture();
    await expect(financeRead(another.actor, f.outlet.organizationId, f.outlet.id, {
      view: "fiscal_readiness", id: f.sale.saleId,
    })).rejects.toThrow();
    await expect(getPool().query("select * from pos_documents")).rejects.toThrow();
  });
});
