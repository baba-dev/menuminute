import { z } from "zod";

export const reportRangeSchema = z.enum(["today", "yesterday", "7d", "30d", "month", "custom"]);
export type ReportRange = z.infer<typeof reportRangeSchema>;

export const reportTabSchema = z.enum(["overview", "menu", "till", "kitchen", "z-report"]);
export type ReportTab = z.infer<typeof reportTabSchema>;

export const reportQuerySchema = z
  .object({
    range: reportRangeSchema.default("today"),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    fulfillmentMode: z.enum(["all", "dine_in", "pickup"]).default("all"),
    tab: reportTabSchema.default("overview"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const isCalendarDate = (date: string | undefined): date is string => {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
      const timestamp = Date.parse(date);
      return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
    };
    if (value.from && !isCalendarDate(value.from)) {
      ctx.addIssue({ code: "custom", message: "Invalid start date", path: ["from"] });
    }
    if (value.to && !isCalendarDate(value.to)) {
      ctx.addIssue({ code: "custom", message: "Invalid end date", path: ["to"] });
    }
    if (value.range === "custom") {
      if (!isCalendarDate(value.from) || !isCalendarDate(value.to)) {
        ctx.addIssue({ code: "custom", message: "Custom dates are required", path: ["range"] });
      } else {
        const elapsed = (Date.parse(value.to) - Date.parse(value.from)) / 86400000;
        if (elapsed < 0 || elapsed > 366) {
          ctx.addIssue({ code: "custom", message: "Range must be 1–367 days", path: ["to"] });
        }
      }
    }
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

// ─── Executive Summary ────────────────────────────────────────────────────────

export type ComparisonDelta = {
  absolutePaise: number;
  percentageChange: number | null; // e.g. +14.2 or -3.5, null if baseline is 0
  direction: "up" | "down" | "flat";
};

export type ExecutiveSummary = {
  currency: string;
  grossSalesMinor: number;
  netSalesMinor: number;
  taxMinor: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgOrderValueMinor: number;
  avgItemsPerOrder: number;
  channelBreakdown: {
    dineInOrders: number;
    dineInSalesMinor: number;
    pickupOrders: number;
    pickupSalesMinor: number;
  };
  deltas: {
    grossSales: ComparisonDelta;
    netSales: ComparisonDelta;
    totalOrders: ComparisonDelta;
    avgOrderValue: ComparisonDelta;
  };
};

// ─── Hourly Trajectory ────────────────────────────────────────────────────────

export type HourlyTrajectoryPoint = {
  hour: number; // 0..23
  label: string; // e.g. "12:00"
  salesMinor: number;
  orderCount: number;
  benchmarkMinor: number; // e.g. average from previous periods
};

// ─── Menu Engineering (Kasavana-Smith BCG Matrix) ─────────────────────────────

export type MenuEngineeringQuadrant = "star" | "plowhorse" | "puzzle" | "dog";

export type MenuEngineeringItem = {
  dishId: string;
  name: string;
  categoryName: string;
  unitPriceMinor: number;
  quantitySold: number;
  totalRevenueMinor: number;
  popularitySharePct: number; // % of total items sold
  quadrant: MenuEngineeringQuadrant;
  recommendation: string;
};

export type CategorySalesShare = {
  categoryName: string;
  orderCount: number;
  revenueMinor: number;
  percentageShare: number;
};

export type MenuEngineeringReport = {
  totalItemsSold: number;
  totalMenuRevenueMinor: number;
  averageItemPopularity: number;
  averageItemRevenueMinor: number;
  quadrants: {
    stars: MenuEngineeringItem[];
    plowhorses: MenuEngineeringItem[];
    puzzles: MenuEngineeringItem[];
    dogs: MenuEngineeringItem[];
  };
  topSellers: MenuEngineeringItem[];
  underperformers: MenuEngineeringItem[];
  categoryShares: CategorySalesShare[];
};

// ─── Till & Shift Reconciliation ──────────────────────────────────────────────

export type TenderSummary = {
  method: string;
  label: string;
  tenderCount: number;
  amountMinor: number;
  percentage: number;
};

export type ShiftReconciliationRow = {
  shiftId: string;
  registerName: string;
  cashierName: string;
  state: "open" | "closed";
  openedAt: string;
  closedAt: string | null;
  openingFloatMinor: number;
  cashTakenMinor: number;
  cashRefundMinor: number;
  expectedMinor: number | null;
  countedMinor: number | null;
  varianceMinor: number | null;
};

export type RefundAuditRow = {
  id: string;
  orderId: string;
  amountMinor: number;
  reason: string;
  actorName: string;
  createdAt: string;
};

export type TillReconciliationReport = {
  /** Financial data may be hidden from operators without settlement privileges. */
  available: boolean;
  currency: string;
  totalCollectedMinor: number;
  totalRefundedMinor: number;
  netCashFlowMinor: number;
  totalVarianceMinor: number;
  tenders: TenderSummary[];
  shifts: ShiftReconciliationRow[];
  recentRefunds: RefundAuditRow[];
};

// ─── Kitchen Velocity ─────────────────────────────────────────────────────────

export type StationPrepLoad = {
  stationId: string;
  stationName: string;
  ticketsHandled: number;
  avgPrepMinutes: number;
};

export type SlaDistribution = {
  fastCount: number; // < 12 mins
  standardCount: number; // 12 - 22 mins
  delayedCount: number; // > 22 mins
  fastPct: number;
  standardPct: number;
  delayedPct: number;
};

export type KitchenVelocityReport = {
  available: boolean;
  totalTickets: number;
  avgPrepMinutes: number;
  medianPrepMinutes: number;
  sla: SlaDistribution;
  stations: StationPrepLoad[];
  hourlyBottlenecks: {
    hour: number;
    label: string;
    ticketCount: number;
    avgPrepMinutes: number;
  }[];
};

// ─── Daily Z-Report ───────────────────────────────────────────────────────────

export type DailyZReportData = {
  provisional: true;
  financeAvailable: boolean;
  reportNumber: string;
  businessDate: string;
  generatedAt: string;
  outletName: string;
  currency: string;
  timezone: string;
  grossSalesMinor: number;
  netSalesMinor: number;
  taxCollectedMinor: number;
  discountsMinor: number | null;
  refundsMinor: number | null;
  orderCount: number;
  coversCount: number | null;
  tenders: TenderSummary[];
  shifts: ShiftReconciliationRow[];
  taxBreakdown: {
    rateLabel: string;
    taxableMinor: number;
    taxMinor: number;
  }[];
  topDishes: {
    name: string;
    quantity: number;
    totalMinor: number;
  }[];
};

// ─── Full Reports Workspace Snapshot ──────────────────────────────────────────

export type ReportsWorkspaceData = {
  outlet: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
    publicId: string;
  };
  query: ReportQuery;
  dateRange: {
    from: string;
    to: string;
    label: string;
  };
  executive: ExecutiveSummary;
  hourlyTrajectory: HourlyTrajectoryPoint[];
  menuEngineering: MenuEngineeringReport;
  tillReconciliation: TillReconciliationReport;
  kitchenVelocity: KitchenVelocityReport;
  dailyZReport: DailyZReportData;
};
