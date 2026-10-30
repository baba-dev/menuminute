import { getRestaurantById } from "@/modules/restaurants/service";
import { listMenus, menuDetail } from "@/modules/menu-product/service";
import { availableNow } from "@/modules/menu-product/contracts";
import { listImports } from "@/modules/menu-import/service";
import { dashboardQrRows } from "@/modules/menu-product/dashboard-data";
import { getReportsWorkspace } from "@/modules/reports/service";
import { reportQuerySchema } from "@/modules/reports/contracts";
import { withOutletRead } from "@/modules/tenancy/service";
import type { ToolContext } from "./read-tools";

export const reportPeriods = ["today", "yesterday", "week", "7d", "30d", "month"] as const;
export type ReportPeriod = (typeof reportPeriods)[number];

/** Calendar week is Monday–today in the restaurant's timezone, not the server's. */
export function weekWindow(timezone: string, instant = new Date()) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => date.find((p) => p.type === type)?.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const parsed = new Date(today + "T00:00:00Z");
  if (Number.isNaN(parsed.valueOf())) throw new Error("Invalid outlet date");
  const weekday = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - ((weekday + 6) % 7));
  return { from: parsed.toISOString().slice(0, 10), to: today };
}

/** Read existing reports projections, never sum order counts as payments. */
export async function merchantReport(context: ToolContext, range: ReportPeriod) {
  const outlet = await getRestaurantById(context.actor, context.outletId);
  if (!outlet || outlet.organizationId !== context.organizationId)
    throw new Error("Outlet unavailable");
  const selected = range === "week" ? weekWindow(outlet.timezone) : null;
  const report = await getReportsWorkspace(context.actor, context.outletId,
    reportQuerySchema.parse({
      range: selected ? "custom" : range,
      ...(selected ?? {}),
      fulfillmentMode: "all",
      tab: "z-report",
    }));
  const till = report.tillReconciliation;
  return {
    source: "reports.getReportsWorkspace",
    data: {
      period: report.dateRange,
      timezone: report.outlet.timezone,
      currency: report.executive.currency,
      /** Submitted order value is not a received payment or bank settlement. */
      orderValueMinor: report.executive.grossSalesMinor,
      orderCount: report.executive.totalOrders,
      completedOrderCount: report.executive.completedOrders,
      cancelledOrderCount: report.executive.cancelledOrders,
      averageOrderValueMinor: report.executive.avgOrderValueMinor,
      paymentEvidenceAvailable: till.available,
      ...(till.available ? {
        operatorRecordedCollectedMinor: till.totalCollectedMinor,
        operatorRecordedRefundedMinor: till.totalRefundedMinor,
        operatorRecordedNetMinor: till.netCashFlowMinor,
        bankReconciliationVerified: false,
      } : {}),
      topSellingDishes: report.menuEngineering.topSellers.slice(0, 5).map((x) => ({
        dish: x.name, quantity: x.quantitySold,
        orderValueMinor: x.totalRevenueMinor,
      })),
      limitation: "Orders are not bank-verified revenue; staff attestations are not provider confirmations.",
    },
  };
}

/**
 * Search ONLY published menu releases visible to the current outlet.
 * Drafts, archived dishes and other outlets are not market-facing stock.
 * Missing results are explicitly inconclusive when menus exceed the cap.
 */
export async function merchantFindDish(context: ToolContext, rawQuery: string) {
  const outlet = await getRestaurantById(context.actor, context.outletId);
  if (!outlet || outlet.organizationId !== context.organizationId)
    throw new Error("Outlet unavailable");
  await withOutletRead(context.actor, context.outletId, "menu.read", async () => true);
  const query = rawQuery.trim().toLocaleLowerCase();
  const menus = (await listMenus(context.actor, context.outletId))
    .filter((m) => !m.archived && m.publishedRevision !== null);
  const limited = menus.length > 12;
  const matches: Array<{
    dish: string; menu: string; category: string; soldOut: boolean;
    availableNow: boolean; currency: string; priceMinor: number;
  }> = [];
  for (const row of menus.slice(0, 12)) {
    const detail = await menuDetail(context.actor, row.id);
    const published = detail.publishedDocument;
    if (!published) continue;
    const overrides = detail.overrides.filter((o) => o.outletId === context.outletId);
    const menuOpen = availableNow(published.schedule, outlet.timezone, new Date());
    for (const category of published.categories) {
      if (category.archived) continue;
      for (const dish of category.items) {
        if (dish.archived || !dish.name.toLocaleLowerCase().includes(query)) continue;
        const override = overrides.find((o) => o.dishId === dish.id);
        const soldOut = (override?.soldOut ?? dish.soldOut) ||
          (dish.variants.length > 0 && dish.variants.every((v) => !v.isAvailable)) ||
          dish.addOnGroups.some((g) => g.options.filter((v) => v.isAvailable).length < g.min);
        matches.push({
          dish: dish.name, menu: published.name, category: category.name,
          soldOut, availableNow: menuOpen && !soldOut &&
            availableNow(dish.schedule, outlet.timezone, new Date()),
          currency: published.currency, priceMinor: override?.priceMinor ?? dish.priceMinor,
        });
        if (matches.length >= 10) break;
      }
      if (matches.length >= 10) break;
    }
    if (matches.length >= 10) break;
  }
  return {
    source: "menu.publishedRelease",
    data: {
      query: rawQuery, matches,
      truncated: limited || matches.length >= 10,
      definitiveNotFound: !limited && matches.length === 0,
      checkedPublishedMenus: Math.min(menus.length, 12),
      note: "Availability reflects the published menu and current item/menu schedule, not whether the restaurant is physically open.",
    },
  };
}

export async function merchantImports(context: ToolContext) {
  const rows = await listImports(context.actor, context.outletId);
  return {
    source: "menuImport.listImports",
    data: {
      imports: rows.slice(0, 8).map((x) => ({
        status: x.status, createdAt: x.createdAt, updatedAt: x.updatedAt,
        hasTargetMenu: Boolean(x.targetMenuId),
      })),
      truncated: rows.length > 8,
      note: "Private import status only; results require human review and are never published automatically.",
    },
  };
}
export async function merchantQr(context: ToolContext) {
  const rows = await dashboardQrRows(context.actor.userId, context.outletId);
  return {
    source: "menuProduct.dashboardQrRows",
    data: {
      total: rows.length,
      active: rows.filter((x) => x.isActive).length,
      byPurpose: rows.reduce<Record<string, number>>((acc, x) => {
        const purpose = String(x.purpose);
        acc[purpose] = (acc[purpose] ?? 0) + 1;
        return acc;
      }, {}),
      note: "Counts describe saved QR records, not scans or visits.",
    },
  };
}
