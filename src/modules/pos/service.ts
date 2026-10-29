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
    paymentMethod: z
      .enum(["cash", "upi_external", "card_external", "bank_external", "other"])
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.markAsPaid && !input.paymentMethod)
      ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Select a payment method" });
    if (!input.markAsPaid && input.paymentMethod)
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "Payment method requires Mark as Paid",
      });
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
export type PosRecentPage = {
  items: Array<{
    saleId: string;
    orderId: string;
    orderNumber: number;
    origin: string;
    currency: string;
    subtotalMinor: string;
    status: string;
    paymentStatus: string;
    createdAt: string;
  }>;
  page: number;
  total: number;
  hasMore: boolean;
};
export async function posRecentPage(
  actor: Actor,
  organizationId: string,
  outletId: string,
  page: number
): Promise<PosRecentPage> {
  await posContext(actor, organizationId, outletId);
  if (!Number.isInteger(page) || page < 0 || page > 1000)
    throw new ValidationError("Invalid register page");
  const result = (await posCall(actor, outletId, (run) =>
    run(sql`select app_private.pos_recent_sales_page(${outletId},${page}) as data`)
  )) as { rows: { data: PosRecentPage }[] };
  return result.rows[0]!.data;
}
export type PosReceipt = {
  saleId: string;
  orderNumber: number;
  createdAt: string;
  currency: string;
  subtotalMinor: string;
  paymentStatus: "pending" | "complete";
  paymentEvidence: "staff_recorded" | "none";
  paymentMethod: string | null;
  sellerName: string | null;
  sellerAddress: string | null;
  customerName: string | null;
  fulfillmentMode: string;
  issuedDocumentId: string | null;
  items: Array<{
    name: string;
    variant: string | null;
    quantity: number;
    unitMinor: string;
    lineMinor: string;
  }>;
};
export async function posReceipt(
  actor: Actor,
  organizationId: string,
  outletId: string,
  saleId: string
): Promise<PosReceipt> {
  identity.parse(saleId);
  await posContext(actor, organizationId, outletId);
  const result = (await posCall(actor, outletId, (run) =>
    run(sql`select app_private.pos_receipt_data(${outletId},${saleId}) as data`)
  )) as { rows: { data: PosReceipt }[] };
  return result.rows[0]!.data;
}

export type PosDailyKpis = {
  totalSalesMinor: string;
  totalOrders: number;
  refundedMinor: string;
};

/** Local calendar day of the active outlet. One canonical order is counted once.
 * Finance refunds are deducted once by immutable refund ID, not by visible page rows.
 * This measures paid orders placed today rather than cash-flow settlement time.
 */

export type PosIncomingOrder = {
  orderId: string;
  orderNumber: number;
  version: number;
  source: "guest_menu" | "online";
  customerName: string | null;
  servicePoint: string | null;
  fulfillmentMode: string;
  createdAt: string;
  currency: string;
  subtotalMinor: string;
  status: string;
  paymentStatus: string;
  items: { name: string; quantity: number; variant: string | null; notes: string | null }[];
};

export async function posIncomingOrders(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<{ orders: PosIncomingOrder[]; overflow: boolean }> {
  await posContext(actor, organizationId, outletId);
  const result = (await posCall(actor, outletId, (run) =>
    run(sql`
    select o.id as "orderId",o.order_number as "orderNumber",o.version,
      o.intake_source as source,o.customer_name as "customerName",
      case when t.id is not null then coalesce(t.label,'Table '||t.table_number) else null end as "servicePoint",
      o.fulfillment_mode as "fulfillmentMode",o.created_at as "createdAt",
      o.currency,o.subtotal_minor::text as "subtotalMinor",o.status,
      o.payment_status as "paymentStatus",
      coalesce((select jsonb_agg(jsonb_build_object(
        'name',i.item_name,'quantity',i.quantity,'variant',i.variant_name,'notes',i.notes)
        order by i.id) from order_items i where i.restaurant_id=${outletId}
        and i.order_id=o.id),'[]'::jsonb) as items
    from orders o left join restaurant_tables t on t.id=o.table_id
      and t.restaurant_id=o.restaurant_id
    where o.restaurant_id=${outletId} and o.status='pending'
      and o.intake_source in ('guest_menu','online')
      and app_private.can_outlet(${outletId},'orders.read')
    order by o.created_at,o.id limit 51
  `)
  )) as { rows: PosIncomingOrder[] };
  return { orders: result.rows.slice(0, 50), overflow: result.rows.length > 50 };
}

export const posRegisterQuerySchema = z
  .object({
    period: z.enum(["today", "week", "all"]).default("today"),
    source: z.enum(["all", "staff_pos", "guest_menu", "online", "unknown"]).default("all"),
    status: z
      .enum([
        "all",
        "pending",
        "accepted",
        "preparing",
        "ready",
        "served",
        "collected",
        "cancelled",
        "rejected",
        "expired",
      ])
      .default("all"),
    payment: z.enum(["all", "paid", "unpaid", "voided"]).default("all"),
    search: z.string().trim().max(80).default(""),
    cursor: z.string().max(400).optional(),
  })
  .strict();
export type PosRegisterQuery = z.infer<typeof posRegisterQuerySchema>;
export type PosRegisterRow = {
  orderId: string;
  orderNumber: number;
  createdAt: string;
  source: string;
  customerName: string | null;
  servicePoint: string | null;
  fulfillmentMode: string;
  status: string;
  paymentStatus: string;
  paymentEvidence: string | null;
  currency: string;
  totalMinor: string;
  saleId: string | null;
  items: {
    name: string;
    quantity: number;
    variant: string | null;
    notes: string | null;
    totalMinor: number;
  }[];
};
export type PosRegisterPage = { items: PosRegisterRow[]; total: number; nextCursor: string | null };

export async function posOrderRegister(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<PosRegisterPage> {
  const q = posRegisterQuerySchema.parse(raw);
  await posContext(actor, organizationId, outletId);
  let cursorAt: string | null = null,
    cursorId: string | null = null;
  if (q.cursor) {
    try {
      const data = JSON.parse(Buffer.from(q.cursor, "base64url").toString("utf8")) as {
        at: string;
        id: string;
      };
      if (
        !data ||
        typeof data.at !== "string" ||
        !Number.isFinite(Date.parse(data.at)) ||
        typeof data.id !== "string" ||
        data.id.length > 128 ||
        !data.id.length
      )
        throw new Error("Malformed cursor");
      cursorAt = new Date(data.at).toISOString();
      cursorId = data.id;
    } catch {
      throw new ValidationError("Invalid register cursor");
    }
  }
  const pattern = "%" + q.search.replace(/[\\%_]/g, "\\export const posAcceptSchema") + "%";
  const predicate = sql`o.restaurant_id=${outletId}
    and app_private.can_outlet(${outletId},'orders.read')
    and (${q.source}='all' or o.intake_source=${q.source})
    and (${q.status}='all' or o.status=${q.status})
    and (${q.payment}='all' or o.payment_status=${q.payment})
    and (${q.period}='all'
      or (${q.period}='today' and o.created_at>=
        ((now() at time zone r.timezone)::date::timestamp at time zone r.timezone)
        and o.created_at<(((now() at time zone r.timezone)::date+1)::timestamp at time zone r.timezone))
      or (${q.period}='week' and o.created_at>=now()-interval '7 days'))
    and (${q.search}='' or o.order_number::text ilike ${pattern} escape '\\'
      or o.customer_name ilike ${pattern} escape '\\'
      or t.label ilike ${pattern} escape '\\'
      or exists(select 1 from order_items i where i.restaurant_id=${outletId}
       and i.order_id=o.id and i.item_name ilike ${pattern} escape '\\'))`;
  const rows = await posCall(actor, outletId, async (run) => {
    const [result, count] = await Promise.all([
      run(sql`select o.id as "orderId",o.order_number as "orderNumber",
        o.created_at as "createdAt",o.intake_source as source,
        o.customer_name as "customerName",
        case when t.id is not null then coalesce(t.label,'Table '||t.table_number) else null end as "servicePoint",
        o.fulfillment_mode as "fulfillmentMode",o.status,o.payment_status as "paymentStatus",
        case when a.sale_id is not null then 'staff_recorded'
             when pt.sale_id is not null then 'finance_recorded' else null end as "paymentEvidence",
        o.currency,coalesce(b.total_minor,o.total_minor)::text as "totalMinor",
        s.id as "saleId",
        coalesce((select jsonb_agg(jsonb_build_object(
         'name',i.item_name,'quantity',i.quantity,'variant',i.variant_name,
         'notes',i.notes,'totalMinor',i.total_minor) order by i.id)
         from order_items i where i.restaurant_id=${outletId} and i.order_id=o.id),
         '[]'::jsonb) as items
       from orders o join restaurants r on r.id=o.restaurant_id
       left join restaurant_tables t on t.id=o.table_id and t.restaurant_id=o.restaurant_id
       left join pos_sales s on s.order_id=o.id and s.outlet_id=o.restaurant_id
       left join pos_bills b on b.sale_id=s.id and b.outlet_id=o.restaurant_id
       left join pos_staff_payment_attestations a on a.sale_id=s.id and a.outlet_id=o.restaurant_id
       left join lateral (select pt.sale_id from pos_tenders pt where pt.outlet_id=o.restaurant_id
         and pt.sale_id=s.id limit 1) pt on true
       where ${predicate}
       and (${cursorAt}::timestamptz is null or
        o.created_at<${cursorAt}::timestamptz or
        (o.created_at=${cursorAt}::timestamptz and o.id<${cursorId}))
       order by o.created_at desc,o.id desc limit 11`),
      run(sql`select count(*)::int as total from orders o
        join restaurants r on r.id=o.restaurant_id
        left join restaurant_tables t on t.id=o.table_id and t.restaurant_id=o.restaurant_id
        where ${predicate}`),
    ]);
    return {
      items: (result as { rows: PosRegisterRow[] }).rows,
      total: (count as { rows: { total: number }[] }).rows[0]?.total ?? 0,
    };
  });
  const hasMore = rows.items.length > 10;
  const items = rows.items.slice(0, 10);
  const last = items.at(-1);
  const nextCursor =
    hasMore && last
      ? Buffer.from(
          JSON.stringify({
            at: new Date(last.createdAt).toISOString(),
            id: last.orderId,
          })
        ).toString("base64url")
      : null;
  return { items, total: rows.total, nextCursor };
}

export const posAcceptSchema = z
  .object({
    key: z.string().uuid(),
    orderId: identity,
    expectedVersion: z.number().int().positive(),
  })
  .strict();

export async function posAcceptCustomerOrder(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<PosSaleResult> {
  const input = posAcceptSchema.parse(raw);
  await posContext(actor, organizationId, outletId);
  const hash = digest(input);
  return posCall(actor, outletId, async (run) => {
    const result = (await run(sql`select app_private.pos_accept_customer_order(
      ${outletId},${input.orderId},${input.expectedVersion},
      ${input.key},${hash}) as data`)) as { rows: { data: PosSaleResult }[] };
    return result.rows[0]!.data;
  });
}

export async function posDailyKpis(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<PosDailyKpis> {
  const context = await posContext(actor, organizationId, outletId);
  if (context.organizationId !== organizationId) throw new NotFoundError("Outlet");
  const result = (await posCall(actor, outletId, (run) =>
    run(sql`with local_day as (
      select ((now() at time zone timezone)::date::timestamp at time zone timezone) as day_start,
        (((now() at time zone timezone)::date + 1)::timestamp at time zone timezone) as day_end
      from restaurants where id = ${outletId}
    ), paid as (
      select coalesce(sum(coalesce(b.total_minor,o.total_minor)::bigint),0) as amount
      from orders o
      cross join local_day d
      left join pos_sales s on s.order_id=o.id and s.outlet_id=o.restaurant_id
      left join pos_bills b on b.sale_id=s.id and b.outlet_id=o.restaurant_id
      where o.restaurant_id=${outletId} and o.payment_status='paid'
        and o.created_at>=d.day_start and o.created_at<d.day_end
    ), refunds as (
      select coalesce(sum(f.amount_minor),0) as amount
      from pos_refunds f cross join local_day d
      where f.outlet_id=${outletId} and f.created_at>=d.day_start
        and f.created_at<d.day_end
    )
    select (select count(*)::int from orders o cross join local_day d
      where o.restaurant_id=${outletId} and o.created_at>=d.day_start
        and o.created_at<d.day_end) as "totalOrders",
      ((select amount from paid)-(select amount from refunds))::text as "totalSalesMinor",
      (select amount::text from refunds) as "refundedMinor"`)
  )) as { rows: PosDailyKpis[] };
  return result.rows[0] ?? { totalSalesMinor: "0", totalOrders: 0, refundedMinor: "0" };
}

export async function posWorkspace(actor: Actor, organizationId: string, outletId: string) {
  const context = await posContext(actor, organizationId, outletId);
  if (!context.enabled)
    return {
      context,
      menus: [],
      recent: [],
      recentPagination: { page: 0, total: 0, hasMore: false },
      attachable: [],
      kpis: { totalSalesMinor: "0", totalOrders: 0, refundedMinor: "0" } as PosDailyKpis,
    };
  const [product, recentResult, attachableResult, kpis] = await Promise.all([
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
    posDailyKpis(actor, organizationId, outletId),
  ]);
  const recentPage = (recentResult as { rows: { data: PosRecentPage }[] }).rows[0]?.data ?? {
    items: [],
    page: 0,
    total: 0,
    hasMore: false,
  };
  const recent = recentPage.items;
  const recentPagination = {
    page: recentPage.page,
    total: recentPage.total,
    hasMore: recentPage.hasMore,
  };
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
  if (!product) return { context, menus: [], recent, recentPagination, attachable, kpis };
  const instant = new Date(product.now);
  const menus = product.menus.map((menu) => ({
    id: menu.id,
    revision: menu.revision,
    ...projectMenu(menu.document, product.outlet.timezone, instant, menu.overrides),
  }));
  return { context, menus, recent, recentPagination, attachable, kpis };
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
  if (input.markAsPaid && !input.paymentMethod)
    throw new ValidationError("Choose a staff-recorded payment method");
  if (!input.markAsPaid && input.paymentMethod)
    throw new ValidationError("Payment method requires Mark as Paid");
  const hash = digest(input);
  const prior = await replay(actor, outletId, input.key, hash, "submit_order");
  if (prior) {
    const receipt = await posReceipt(actor, organizationId, outletId, prior.saleId);
    const order = (await posCall(actor, outletId, (run) =>
      run(sql`select status from orders where id=${prior.orderId} and restaurant_id=${outletId}`)
    )) as { rows: { status: string }[] };
    return {
      ...prior,
      status: order.rows[0]?.status ?? prior.status,
      paymentStatus: receipt.paymentStatus,
      paymentEvidence: receipt.paymentEvidence,
      paymentMethod: receipt.paymentMethod ?? undefined,
    };
  }
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
    const r =
      (await run(sql`select app_private.pos_submit_and_dispatch(${outletId},${input.key},${hash},
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
