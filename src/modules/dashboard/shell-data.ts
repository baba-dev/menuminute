import { sql } from "drizzle-orm";
import { ForbiddenError } from "@/lib/errors";
import { getOutletFloorMatrix } from "@/modules/hospitality/floor-matrix";
import {
  kitchenAvailableDishes,
  staffServiceRequests,
  type GuestServiceRequest,
} from "@/modules/hospitality/service";
import { ordersSqlState } from "@/modules/orders/diagnostics";
import { listServiceRail, servicePulse } from "@/modules/orders/workspace";
import { financeRead, type ShiftRow } from "@/modules/pos/finance";
import { withActor, type Actor } from "@/modules/tenancy/service";

/**
 * Data behind the workspace shell: the topbar till chip, the notification centre and the
 * command palette. Every source goes through the same permission-checked service the
 * matching page uses, and each is isolated: one failing or forbidden source never hides
 * the others, and an unavailable read is never presented as "zero".
 */
export type Section<T> =
  { state: "ready"; data: T } | { state: "restricted" | "unavailable"; data: null };

export async function section<T>(name: string, work: () => Promise<T>): Promise<Section<T>> {
  try {
    return { state: "ready", data: await work() };
  } catch (error) {
    // Some services map a privilege failure to ForbiddenError; others let the raw
    // insufficient_privilege (42501) through. Both mean "not allowed", not "broken".
    if (error instanceof ForbiddenError || ordersSqlState(error) === "42501")
      return { state: "restricted", data: null };
    // Kind and SQLSTATE only: raw errors can contain SQL text or parameters.
    console.error("[dashboard] Shell source unavailable", {
      source: name,
      kind: error instanceof Error ? error.name : "unknown",
      sqlstate: ordersSqlState(error) ?? undefined,
    });
    return { state: "unavailable", data: null };
  }
}

export type TillSummary = {
  open: boolean;
  registers: number;
  currency: string;
  /** Expected cash for open shifts (opening float + cash taken - cash refunded). Not a count. */
  expectedMinor: string | null;
  openedAt: string | null;
};

function minor(value: string | null | undefined): bigint | null {
  return typeof value === "string" && /^-?\d{1,18}$/.test(value) ? BigInt(value) : null;
}

export function summarizeShifts(rows: ShiftRow[], fallbackCurrency: string): TillSummary {
  const open = rows.filter((row) => row.state === "open");
  if (!open.length) {
    return {
      open: false,
      registers: 0,
      currency: fallbackCurrency,
      expectedMinor: null,
      openedAt: null,
    };
  }
  let total = 0n;
  let known = true;
  for (const row of open) {
    const stated = minor(row.expectedMinor);
    if (stated !== null) {
      total += stated;
      continue;
    }
    const opening = minor(row.openingMinor);
    const taken = minor(row.cashTakenMinor);
    const refunded = minor(row.cashRefundMinor);
    if (opening === null || taken === null || refunded === null) known = false;
    else total += opening + taken - refunded;
  }
  const opened = open
    .map((row) => Date.parse(row.openedAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];
  return {
    open: true,
    registers: open.length,
    currency: open[0]!.currency || fallbackCurrency,
    expectedMinor: known ? total.toString() : null,
    openedAt: opened === undefined ? null : new Date(opened).toISOString(),
  };
}

export type RequestSummary = { open: number; unacknowledged: number; oldestAt: string | null };

export function summarizeRequests(rows: GuestServiceRequest[]): RequestSummary {
  const open = rows.filter((row) => row.status !== "resolved");
  const oldest = open
    .map((row) => Date.parse(row.requestedAt))
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b)[0];
  return {
    open: open.length,
    unacknowledged: open.filter((row) => row.status === "requested").length,
    oldestAt: oldest === undefined ? null : new Date(oldest).toISOString(),
  };
}

export type ShellSnapshot = {
  outletId: string;
  checkedAt: string;
  pulse: Section<Awaited<ReturnType<typeof servicePulse>>>;
  requests: Section<RequestSummary>;
  till: Section<TillSummary>;
};

export async function shellSnapshot(
  actor: Actor,
  organizationId: string,
  outletId: string,
  currency: string
): Promise<ShellSnapshot> {
  const [pulse, requests, till] = await Promise.all([
    section("pulse", () => servicePulse(actor, organizationId, outletId)),
    section("requests", async () =>
      summarizeRequests(await staffServiceRequests(actor, organizationId, outletId))
    ),
    section("till", async () =>
      summarizeShifts(
        (await financeRead(actor, organizationId, outletId, { view: "shifts" })) as ShiftRow[],
        currency
      )
    ),
  ]);
  return { outletId, checkedAt: new Date().toISOString(), pulse, requests, till };
}

/** Extra flags the nav capabilities do not carry. Never throws: no grant simply means false. */
export type ShellCapabilities = { menuWrite: boolean; outletManage: boolean };

export async function shellCapabilities(
  actor: Actor,
  outletId: string
): Promise<ShellCapabilities> {
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const result = await tx.execute<{ menuWrite: boolean; outletManage: boolean }>(sql`select
      app_private.can_outlet(${outletId}, 'menu.write') as "menuWrite",
      app_private.can_outlet(${outletId}, 'outlet.manage') as "outletManage"`);
    const row = result.rows[0];
    return { menuWrite: row?.menuWrite === true, outletManage: row?.outletManage === true };
  });
}

export type PaletteDish = {
  id: string;
  menuId: string;
  name: string;
  category: string;
  soldOut: boolean;
};
export type PaletteTable = {
  id: string;
  tableNumber: string;
  label: string | null;
  activeOrders: number;
  unpaidOrders: number;
};
export type PaletteOrder = {
  id: string;
  orderNumber: number;
  status: string;
  servicePoint: string | null;
  fulfillmentMode: string;
  paymentStatus: string;
};
export type PaletteIndex = {
  outletId: string;
  dishes: Section<PaletteDish[]>;
  tables: Section<PaletteTable[]>;
  orders: Section<PaletteOrder[]>;
};

const MAX_DISHES = 500;
const MAX_TABLES = 200;
const MAX_ORDERS = 200;

/** Deliberately minimal: names, numbers and states only; no customer names, phones or notes. */
export async function paletteIndex(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<PaletteIndex> {
  const [dishes, tables, orders] = await Promise.all([
    section("palette.dishes", async () =>
      (await kitchenAvailableDishes(actor, organizationId, outletId))
        .slice(0, MAX_DISHES)
        .map(({ id, menuId, name, category, soldOut }) => ({ id, menuId, name, category, soldOut }))
    ),
    section("palette.tables", async () =>
      (await getOutletFloorMatrix(actor, organizationId, outletId))
        .slice(0, MAX_TABLES)
        .map(({ id, tableNumber, label, activeOrders, unpaidOrders }) => ({
          id,
          tableNumber,
          label,
          activeOrders,
          unpaidOrders,
        }))
    ),
    section("palette.orders", async () =>
      // The rail is oldest-first; keep the most recent, which is what people look up.
      (await listServiceRail(actor, organizationId, outletId)).orders
        .slice(-MAX_ORDERS)
        .map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          servicePoint: order.servicePoint,
          fulfillmentMode: order.fulfillmentMode,
          paymentStatus: order.paymentStatus,
        }))
    ),
  ]);
  return { outletId, dishes, tables, orders };
}
