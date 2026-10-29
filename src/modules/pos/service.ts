import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { publicProduct, type PublicProduct } from "@/modules/menu-product/service";
import { quoteInputSchema, quotePublishedSelection } from "@/modules/orders/quote";
import { projectMenu } from "@/modules/menu-product/projector";
import { availableNow } from "@/modules/menu-product/contracts";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const key = z.string().uuid();
const minorText = z.string().regex(/^(0|[1-9][0-9]{0,18})$/);
export const sellerSettingsSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    enabled: z.boolean(),
    legalName: z.string().trim().min(2).max(160),
    registeredAddress: z.string().trim().min(5).max(500),
    country: z.string().regex(/^[A-Z]{2}$/),
    taxRegime: z.enum(["unconfigured", "not_registered", "requires_review"]),
    taxRegistration: z.string().trim().max(64).nullable(),
  })
  .strict();
export const posSubmissionSchema = z
  .object({
    key,
    selection: quoteInputSchema,
    fulfillmentMode: z.enum(["dine_in", "pickup"]),
    tableId: identity.nullable(),
    customerName: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(500).default(""),
    expectedSubtotalMinor: minorText,
    markAsPaid: z.boolean().default(false),
    paymentMethod: z.enum(["cash", "upi_external", "card_external", "bank_external", "other"]).nullable().default(null),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.markAsPaid && !input.paymentMethod)
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Select a payment method" });
    if (!input.markAsPaid && input.paymentMethod)
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Payment method requires Mark as Paid" });
  });
export const posAttachSchema = z.object({ key, orderId: identity }).strict();

export type PosContext = {
  organizationId: string;
  enabled: boolean;
  revision: number;
  canConfigure: boolean;
  currency: string;
  country: string;
  fulfillmentModes: string[];
  outletName: string;
  token: string | null;
  seller: null | {
    legalName: string;
    registeredAddress: string;
    country: string;
    taxRegime: "unconfigured" | "not_registered" | "requires_review";
    taxRegistration: string | null;
    revision: number;
  };
  tables: { id: string; label: string }[];
};
export type PosSaleResult = {
  saleId: string;
  orderId: string;
  orderNumber: number;
  currency: string;
  subtotalMinor: string;
  status: string;
  taxAndFeesCalculated: false;
  duplicate: boolean;
  paymentStatus?: "pending" | "complete";
  paymentEvidence?: "none" | "staff_recorded";
  paymentMethod?: string;
};

function mapSql(error: unknown): never {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const code = inner && typeof inner === "object" && "code" in inner ? String(inner.code) : "";
  if (code === "42501") throw new ForbiddenError("POS access or activation is required");
  if (code === "40001" || code === "23505")
    throw new ConflictError("POS changed or the request key was reused. Refresh before retrying.");
  if (["22023", "22P02", "23503", "23514", "23502"].includes(code))
    throw new ValidationError(
      "Invalid POS request or an unavailable item. Review the latest menu."
    );
  throw error;
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
/** All scoped POS functions require the actor and selected outlet in one transaction. */
async function posCall<T>(
  actor: Actor,
  outletId: string,
  expression: (run: (query: ReturnType<typeof sql>) => Promise<unknown>) => Promise<T>
): Promise<T> {
  // Deliberately use withActor, never reuse subscription billing.manage or a public-token-only actor.
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    return expression((query) => tx.execute(query));
  }).catch(mapSql);
}
export async function posContext(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<PosContext> {
  identity.parse(outletId);
  identity.parse(organizationId);
  const result = (await posCall(actor, outletId, async (run) =>
    run(sql`select app_private.pos_context(${outletId}) as data`)
  )) as { rows: { data: PosContext }[] };
  const data = result.rows[0]?.data;
  if (!data || data.organizationId !== organizationId) throw new NotFoundError("Outlet");
  return data;
}
async function catalog(context: PosContext, outletId: string): Promise<PublicProduct> {
  if (!context.enabled) throw new ForbiddenError("Enable the draft POS for this outlet first");
  if (!context.token) throw new ValidationError("Publish a menu and enable its QR code first");
  const product = await publicProduct(context.token);
  if (
    !product ||
    product.outlet.id !== outletId ||
    !product.outlet.versioned ||
    product.outlet.isDemoData
  )
    throw new ConflictError("The selected published menu is unavailable");
  return product;
}
export type PosRecentPage = { items: Array<{ saleId: string; orderId: string; orderNumber: number; origin: string; currency: string; subtotalMinor: string; status: string; paymentStatus: string; createdAt: string }>; page: number; total: number; hasMore: boolean };
export async function posRecentPage(actor: Actor, organizationId: string, outletId: string, page: number): Promise<PosRecentPage> {
  await posContext(actor, organizationId, outletId);
  if (!Number.isInteger(page) || page < 0 || page > 1000) throw new ValidationError("Invalid register page");
  const result = await posCall(actor, outletId, (run) => run(sql`select app_private.pos_recent_sales_page(${outletId},${page}) as data`)) as {rows:{data: PosRecentPage}[]};
  return result.rows[0]!.data;
}
export type PosReceipt = { saleId: string; orderNumber: number; createdAt: string; currency: string; subtotalMinor: string; paymentStatus: "pending" | "complete"; paymentEvidence: "staff_recorded" | "none"; paymentMethod: string | null; sellerName: string | null; sellerAddress: string | null; customerName: string | null; fulfillmentMode: string; issuedDocumentId: string | null; items: Array<{name:string;variant:string|null;quantity:number;unitMinor:string;lineMinor:string}>};
export async function posReceipt(actor: Actor, organizationId: string, outletId: string, saleId: string): Promise<PosReceipt> {
  identity.parse(saleId);
  await posContext(actor, organizationId, outletId);
  const result = await posCall(actor, outletId, (run) => run(sql`select app_private.pos_receipt_data(${outletId},${saleId}) as data`)) as {rows:{data:PosReceipt}[]};
  return result.rows[0]!.data;
}
export async function posWorkspace(actor: Actor, organizationId: string, outletId: string) {
  const context = await posContext(actor, organizationId, outletId);
  if (!context.enabled) return { context, menus: [], recent: [], recentPagination: {page:0,total:0,hasMore:false}, attachable: [] };
  const [product, recentResult, attachableResult] = await Promise.all([
    catalog(context, outletId).catch((error: unknown) => {
      if (error instanceof ConflictError || error instanceof ValidationError) return null;
      throw error;
    }),
    posCall(actor, outletId, (run) =>
      run(sql`select app_private.pos_recent_sales_page(${outletId},${0}) as data`)
    ),
    posCall(actor, outletId, (run) =>
      run(sql`select app_private.pos_attachable_orders(${outletId}) as data`)
    ),
  ]);
  const recentPage = (recentResult as {rows:{data:PosRecentPage}[]}).rows[0]?.data ?? {items:[],page:0,total:0,hasMore:false};
  const recent = recentPage.items;
  const recentPagination = {page:recentPage.page,total:recentPage.total,hasMore:recentPage.hasMore};
  const attachable =
    (
      attachableResult as {
        rows: {
          data: Array<{
            orderId: string;
            orderNumber: number;
            customerName: string | null;
            fulfillmentMode: string;
            status: string;
            currency: string;
            subtotalMinor: string;
            createdAt: string;
          }>;
        }[];
      }
    ).rows[0]?.data ?? [];
  // An enabled outlet may not yet have a published menu or active QR. Keep finance history
  // accessible rather than turning the entire private page into an error screen.
  if (!product) return { context, menus: [], recent, recentPagination, attachable };
  const instant = new Date(product.now);
  const menus = product.menus.map((menu) => ({
    id: menu.id,
    revision: menu.revision,
    ...projectMenu(menu.document, product.outlet.timezone, instant, menu.overrides),
  }));
  return { context, menus, recent, recentPagination, attachable };
}
export async function posConfigure(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  const input = sellerSettingsSchema.parse(raw);
  await posContext(actor, organizationId, outletId);
  return posCall(actor, outletId, async (run) => {
    const r = (await run(sql`select app_private.pos_configure(${outletId},${input.expectedRevision},
       ${JSON.stringify(input)}::jsonb) as data`)) as {
      rows: { data: { enabled: boolean; revision: number } }[];
    };
    return r.rows[0]!.data;
  });
}
async function replay(actor: Actor, outletId: string, k: string, hash: string, action: string) {
  return posCall(actor, outletId, async (run) => {
    const r = (await run(
      sql`select app_private.pos_lookup_command(${outletId},${k},${hash},${action}) as data`
    )) as { rows: { data: PosSaleResult | null }[] };
    return r.rows[0]?.data ?? null;
  });
}
export async function posSubmit(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<PosSaleResult> {
  const input = posSubmissionSchema.parse(raw);
  const context = await posContext(actor, organizationId, outletId);
  if (input.markAsPaid && !input.paymentMethod) throw new ValidationError("Choose a staff-recorded payment method");
  if (!input.markAsPaid && input.paymentMethod) throw new ValidationError("Payment method requires Mark as Paid");
  const hash = digest(input);
  const prior = await replay(actor, outletId, input.key, hash, "submit_order");
  if (prior) return prior;
  const product = await catalog(context, outletId);
  if (
    product.outlet.fulfillmentModes &&
    !product.outlet.fulfillmentModes.includes(input.fulfillmentMode)
  )
    throw new ValidationError("Fulfillment mode is not enabled for this outlet");
  const instant = new Date();
  const quote = quotePublishedSelection(product, input.selection, instant);
  if (quote.subtotalMinor !== input.expectedSubtotalMinor)
    throw new ConflictError("The published price changed. Review the revised cart.");
  if (input.tableId && input.fulfillmentMode !== "dine_in")
    throw new ValidationError("A table can only be selected for dine-in service");
  const menuRelease = product.menus.find((m) => m.id === quote.menuId)!;
  const chosenDishIds = new Set(input.selection.lines.map((line) => line.dishId));
  const schedules = menuRelease.document.categories.flatMap((category) =>
    category.items
      .filter((item) => chosenDishIds.has(item.id))
      .map((item) => ({
        menu: menuRelease.document.schedule,
        dish: item.schedule,
      }))
  );
  let expiresAt = new Date(instant.getTime() + 2 * 60 * 60 * 1000);
  if (schedules.some((schedule) => schedule.menu || schedule.dish)) {
    for (let minute = 1; minute <= 120; minute++) {
      const at = new Date(instant.getTime() + minute * 60000);
      if (
        schedules.some(
          (schedule) =>
            !availableNow(schedule.menu, product.outlet.timezone, at) ||
            !availableNow(schedule.dish, product.outlet.timezone, at)
        )
      ) {
        expiresAt = at;
        break;
      }
    }
  }
  const payload = {
    token: context.token,
    expiresAt: expiresAt.toISOString(),
    menuId: quote.menuId,
    revision: quote.revision,
    catalogFingerprint: product.catalogFingerprint,
    quotedAt: instant.toISOString(),
    fulfillmentMode: input.fulfillmentMode,
    tableId: input.tableId,
    customerName: input.customerName,
    notes: input.notes,
    expectedSubtotalMinor: quote.subtotalMinor,
    lines: input.selection.lines,
    markAsPaid: input.markAsPaid,
    paymentMethod: input.markAsPaid ? input.paymentMethod : null,
  };
  return posCall(actor, outletId, async (run) => {
    const r = (await run(sql`select app_private.pos_submit_order_with_attestation(${outletId},${input.key},${hash},
      ${JSON.stringify(payload)}::jsonb) as data`)) as { rows: { data: PosSaleResult }[] };
    return r.rows[0]!.data;
  });
}
export async function posAttachOrder(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<PosSaleResult> {
  const input = posAttachSchema.parse(raw);
  await posContext(actor, organizationId, outletId);
  const hash = digest(input);
  const previous = await replay(actor, outletId, input.key, hash, "attach_order");
  if (previous) return previous;
  return posCall(actor, outletId, async (run) => {
    const r = (await run(
      sql`select app_private.pos_attach_order(${outletId},${input.orderId},${input.key},${hash}) as data`
    )) as { rows: { data: PosSaleResult }[] };
    return r.rows[0]!.data;
  });
}

export type PosWorkspace = Awaited<ReturnType<typeof posWorkspace>>;
