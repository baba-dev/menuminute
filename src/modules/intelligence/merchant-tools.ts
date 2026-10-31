import { getRestaurantById } from "@/modules/restaurants/service";
import { listMenus, menuDetail } from "@/modules/menu-product/service";
import { availableNow } from "@/modules/menu-product/contracts";
import { listImports } from "@/modules/menu-import/service";
import { dashboardQrRows } from "@/modules/menu-product/dashboard-data";
import { getReportsWorkspace } from "@/modules/reports/service";
import { reportQuerySchema } from "@/modules/reports/contracts";
import { withOutletRead } from "@/modules/tenancy/service";
import { staffServiceRequests } from "@/modules/hospitality/service";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";
import { billingState } from "@/modules/billing/service";
import { ForbiddenError } from "@/lib/errors";
import type { ToolContext } from "./read-tools";

export const reportPeriods = ["today", "yesterday", "week", "7d", "30d", "month"] as const;
export type ReportPeriod = (typeof reportPeriods)[number];

/** Calendar week is Monday–today in the restaurant's timezone, not the server's. */
export function weekWindow(timezone: string, instant = new Date()) {
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => date.find((p) => p.type === type)?.value;
  const today = `${value("year")}-${value("month")}-${value("day")}`;
  const parsed = new Date(today + "T00:00:00Z");
  if (Number.isNaN(parsed.valueOf())) throw new Error("Invalid outlet date");
  const weekday = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - ((weekday + 6) % 7));
  return { from: parsed.toISOString().slice(0, 10), to: today };
}

async function loadReport(context: ToolContext, range: ReportPeriod) {
  const outlet = await getRestaurantById(context.actor, context.outletId);
  if (!outlet || outlet.organizationId !== context.organizationId)
    throw new Error("Outlet unavailable");
  const selected = range === "week" ? weekWindow(outlet.timezone) : null;
  return getReportsWorkspace(
    context.actor,
    context.outletId,
    reportQuerySchema.parse({
      range: selected ? "custom" : range,
      ...(selected ?? {}),
      fulfillmentMode: "all",
      tab: "z-report",
    })
  );
}

/** Read existing reports projections, never sum order counts as payments. */
export async function merchantReport(context: ToolContext, range: ReportPeriod) {
  const report = await loadReport(context, range);
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
      ...(till.available
        ? {
            operatorRecordedCollectedMinor: till.totalCollectedMinor,
            operatorRecordedRefundedMinor: till.totalRefundedMinor,
            operatorRecordedNetMinor: till.netCashFlowMinor,
            bankReconciliationVerified: false,
          }
        : {}),
      topSellingDishes: report.menuEngineering.topSellers.slice(0, 5).map((x) => ({
        dish: x.name,
        quantity: x.quantitySold,
        orderValueMinor: x.totalRevenueMinor,
      })),
      limitation:
        "Orders are not bank-verified revenue; staff attestations are not provider confirmations.",
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
  const menus = (await listMenus(context.actor, context.outletId)).filter(
    (m) => !m.archived && m.publishedRevision !== null
  );
  const limited = menus.length > 12;
  const matches: Array<{
    dish: string;
    menu: string;
    category: string;
    soldOut: boolean;
    availableNow: boolean;
    currency: string;
    priceMinor: number;
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
        const soldOut =
          (override?.soldOut ?? dish.soldOut) ||
          (dish.variants.length > 0 && dish.variants.every((v) => !v.isAvailable)) ||
          dish.addOnGroups.some((g) => g.options.filter((v) => v.isAvailable).length < g.min);
        matches.push({
          dish: dish.name,
          menu: published.name,
          category: category.name,
          soldOut,
          availableNow:
            menuOpen && !soldOut && availableNow(dish.schedule, outlet.timezone, new Date()),
          currency: published.currency,
          priceMinor: override?.priceMinor ?? dish.priceMinor,
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
      query: rawQuery,
      matches,
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
        status: x.status,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
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

const SIGNAL_LABEL = {
  call_server: "asked for a server",
  water_refill: "asked for water",
  bill_request: "asked for the bill",
} as const;

/** Open guest requests (call server, water, bill). Table numbers only; no guest identity. */
export async function merchantServiceRequests(context: ToolContext, now = new Date()) {
  const rows = (await staffServiceRequests(context.actor, context.organizationId, context.outletId))
    .filter((r) => r.status !== "resolved")
    .map((r) => ({
      table: r.tableNumber,
      request: SIGNAL_LABEL[r.signal],
      status: r.status === "acknowledged" ? "seen by staff" : "waiting",
      waitingMinutes: Math.max(0, Math.round((now.getTime() - Date.parse(r.requestedAt)) / 60_000)),
    }))
    .sort((a, b) => b.waitingMinutes - a.waitingMinutes);
  return {
    source: "hospitality.staffServiceRequests",
    data: {
      openCount: rows.length,
      stillWaitingCount: rows.filter((r) => r.status === "waiting").length,
      longestWaitMinutes: rows[0]?.waitingMinutes ?? 0,
      requests: rows.slice(0, 10),
      truncated: rows.length > 10,
    },
  };
}

/** QR code labels, purpose, active state and scan counts. Never the link token or image data. */
export async function merchantQrDetails(context: ToolContext) {
  const rows = await getRestaurantQrCodes(context.actor, context.outletId);
  const view = rows.map((r) => ({
    name: r.label?.trim() || r.pointLabel || "Unnamed QR code",
    table: r.pointLabel ?? null,
    purpose: r.purpose === "order" ? "ordering" : "menu viewing",
    active: r.isActive,
    scans: r.scanCount,
  }));
  return {
    source: "restaurants.qrCodes",
    data: {
      total: view.length,
      active: view.filter((x) => x.active).length,
      totalScans: view.reduce((n, x) => n + x.scans, 0),
      mostScanned: [...view].sort((a, b) => b.scans - a.scans).slice(0, 5),
      inactive: view
        .filter((x) => !x.active)
        .slice(0, 10)
        .map((x) => x.name),
      note: "Scans count how often a code was opened, not orders or visits.",
    },
  };
}

/** Busiest hours, slow sellers and category mix for a period; order values, not payments. */
export async function merchantInsights(context: ToolContext, range: ReportPeriod) {
  const report = await loadReport(context, range);
  const busiest = [...report.hourlyTrajectory]
    .filter((h) => h.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount || a.hour - b.hour)
    .slice(0, 3);
  return {
    source: "reports.getReportsWorkspace",
    data: {
      period: report.dateRange,
      timezone: report.outlet.timezone,
      currency: report.executive.currency,
      busiestHours: busiest.map((h) => ({ hour: h.label, orders: h.orderCount })),
      slowSellingDishes: report.menuEngineering.underperformers.slice(0, 5).map((x) => ({
        dish: x.name,
        quantity: x.quantitySold,
      })),
      categoryShare: report.menuEngineering.categoryShares.slice(0, 6).map((c) => ({
        category: c.categoryName,
        orders: c.orderCount,
        orderValueMinor: c.revenueMinor,
        percentOfOrderValue: Math.round(c.percentageShare * 10) / 10,
      })),
      averagePrepMinutes: report.kitchenVelocity.available
        ? Math.round(report.kitchenVelocity.avgPrepMinutes * 10) / 10
        : null,
      limitation: "Based on submitted orders, not verified payments.",
    },
  };
}

/** Plan and subscription status for owners/admins only; no grant history, IDs or provider data. */
export async function merchantBilling(context: ToolContext) {
  try {
    const s = await billingState(context.actor, context.organizationId);
    return {
      source: "billing.billingState",
      data: {
        freeMenuIncluded: s.freeMenu,
        onlineOrderingActive: s.ordering,
        kitchenScreensActive: s.kitchen,
        paidPlansAvailable: s.billingEnabled,
        subscriptions: (s.subscriptions as Array<Record<string, unknown>>).slice(0, 6).map((x) => ({
          product: String(x["product"] ?? ""),
          status: String(x["status"] ?? ""),
          currentPeriodEnd:
            typeof x["currentPeriodEnd"] === "string" ? x["currentPeriodEnd"] : null,
        })),
        note: "Plan information only. Ember cannot change plans or take payments.",
      },
    };
  } catch (error) {
    if (error instanceof ForbiddenError)
      return {
        source: "billing.billingState",
        data: {
          available: false,
          reason: "Only an account owner or administrator can see plan details.",
        },
      };
    throw error;
  }
}
