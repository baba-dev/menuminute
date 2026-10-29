"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  Printer,
  Download,
  UtensilsCrossed,
  Receipt,
  ChefHat,
  BarChart3,
  Flame,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { formatMoney, formatMinutes } from "@/modules/reports/formatters";
import type { ReportQuery, ReportTab, ReportsWorkspaceData } from "@/modules/reports/contracts";
import { DateRangeBar } from "./date-range-bar";
import { KpiMetricCard } from "./kpi-metric-card";
import { SvgAreaChart } from "./svg-area-chart";
import { SvgBarChart } from "./svg-bar-chart";
import { MenuEngineeringMatrix } from "./menu-engineering-matrix";
import { ZReportPreview } from "./z-report-preview";

export function ReportsHub({ initialData }: { initialData: ReportsWorkspaceData }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [data] = useState(initialData);
  const [activeTab, setActiveTab] = useState<ReportTab>(initialData.query.tab || "overview");

  const {
    outlet,
    executive,
    hourlyTrajectory,
    menuEngineering,
    tillReconciliation,
    kitchenVelocity,
    dailyZReport,
    dateRange,
  } = data;
  const currency = outlet.currency;

  function updateQuery(updates: Partial<ReportQuery>) {
    const newQuery: ReportQuery = {
      ...data.query,
      ...updates,
      tab: updates.tab ?? activeTab,
    };

    const params = new URLSearchParams();
    params.set("range", newQuery.range);
    if (newQuery.from) params.set("from", newQuery.from);
    if (newQuery.to) params.set("to", newQuery.to);
    params.set("fulfillmentMode", newQuery.fulfillmentMode);
    params.set("tab", newQuery.tab);

    startTransition(() => {
      router.push(`/dashboard/reports?${params.toString()}`);
    });
  }

  function handleTabChange(tab: ReportTab) {
    setActiveTab(tab);
    updateQuery({ tab });
  }

  const exportUrl = `/api/reports/export?range=${data.query.range}&fulfillmentMode=${data.query.fulfillmentMode}&tab=${activeTab}${
    data.query.from ? `&from=${data.query.from}` : ""
  }${data.query.to ? `&to=${data.query.to}` : ""}`;

  return (
    <div className="product reports-workspace" data-testid="reports-hub">
      {/* ─── Editorial Hero Header (Matching Menu Studio & QR Studio) ─────── */}
      <header className="reports-hero">
        <div className="reports-hero-copy">
          <span className="reports-eyebrow">MENUMINUTE / REPORTS & INTELLIGENCE</span>
          <h1>
            Every service
            <br />
            told in numbers.
          </h1>
          <p>
            Operational clarity, menu engineering, cashier shift settlements, and kitchen SLAs for{" "}
            <strong>{outlet.name}</strong>.
          </p>
          <div className="reports-hero-meta">
            <span>
              <Clock size={14} aria-hidden="true" /> Timezone: {outlet.timezone}
            </span>
            <span>·</span>
            <span>Currency: {currency}</span>
            <span>·</span>
            <span>Range: {dateRange.label}</span>
          </div>

          <div className="reports-hero-actions">
            <button
              type="button"
              className="reports-hero-primary"
              onClick={() => handleTabChange("z-report")}
            >
              <Printer size={16} aria-hidden="true" /> Print Daily Z-Report
            </button>
            <a href={exportUrl} download className="reports-hero-secondary">
              <Download size={16} aria-hidden="true" /> Export CSV
            </a>
          </div>
        </div>
      </header>

      {/* ─── Main Reports Content ─────────────────────────────────────────── */}
      <main className="reports-body">
        {/* Date Horizon & Channel Filter Strip */}
        <DateRangeBar query={data.query} dateLabel={dateRange.label} onChange={updateQuery} />

        {/* Tab Navigation (Exact qr-tab-nav design) */}
        <nav className="reports-tab-nav" aria-label="Reports categories">
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === "overview" ? "is-active" : ""}`}
            onClick={() => handleTabChange("overview")}
          >
            <BarChart3 size={16} aria-hidden="true" />
            Overview & Sales
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === "menu" ? "is-active" : ""}`}
            onClick={() => handleTabChange("menu")}
          >
            <UtensilsCrossed size={16} aria-hidden="true" />
            Menu Intelligence
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === "till" ? "is-active" : ""}`}
            onClick={() => handleTabChange("till")}
          >
            <Receipt size={16} aria-hidden="true" />
            The Till & Shifts
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === "kitchen" ? "is-active" : ""}`}
            onClick={() => handleTabChange("kitchen")}
          >
            <ChefHat size={16} aria-hidden="true" />
            Kitchen Velocity
          </button>
          <button
            type="button"
            className={`reports-tab-btn ${activeTab === "z-report" ? "is-active" : ""}`}
            onClick={() => handleTabChange("z-report")}
          >
            <Printer size={16} aria-hidden="true" />
            Daily Z-Report
          </button>
        </nav>

        {/* ─── TAB 1: OVERVIEW & SALES PULSE ──────────────────────────────── */}
        {activeTab === "overview" && (
          <div>
            {/* KPI Metrics Strip */}
            <div className="reports-kpis-grid">
              <KpiMetricCard
                label="Gross Sales"
                value={formatMoney(executive.grossSalesMinor, currency)}
                delta={executive.deltas.grossSales}
                subtext="Total billed value"
                icon={<DollarSign size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Net Revenue"
                value={formatMoney(executive.netSalesMinor, currency)}
                delta={executive.deltas.netSales}
                subtext="Excluding taxes"
                icon={<TrendingUp size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Total Orders"
                value={executive.totalOrders.toLocaleString()}
                delta={executive.deltas.totalOrders}
                subtext={`${executive.completedOrders} completed`}
                icon={<ShoppingBag size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Average Order Value"
                value={formatMoney(executive.avgOrderValueMinor, currency)}
                delta={executive.deltas.avgOrderValue}
                subtext={`${executive.avgItemsPerOrder} items / ticket`}
                icon={<Receipt size={18} aria-hidden="true" />}
              />
            </div>

            {/* Hourly Sales Trajectory Area Chart */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Hourly Sales Velocity & Trajectory</h2>
                  <p>Intraday sales performance compared against previous 14-day average.</p>
                </div>
                <div className="reports-panel-legend">
                  <span>
                    <span className="legend-dot is-actual" /> Sales Velocity
                  </span>
                  <span>
                    <span className="legend-dot is-benchmark" /> 14-Day Average
                  </span>
                </div>
              </div>

              <SvgAreaChart data={hourlyTrajectory} currency={currency} />
            </div>

            {/* Split Row: Channel Breakdown & Category Contribution */}
            <div className="reports-split-row">
              {/* Channel Split */}
              <div className="reports-panel">
                <div className="reports-panel-head">
                  <div className="reports-panel-title">
                    <h2>Fulfillment Channels</h2>
                    <p>Volume and revenue by dining modality.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-4 py-2">
                  <div className="flex items-center justify-between border-b border-[var(--rep-line)] pb-3">
                    <div>
                      <div className="text-sm font-extrabold text-[var(--rep-ink)]">
                        Dine-In Tables
                      </div>
                      <div className="text-xs text-[var(--rep-muted)]">
                        {executive.channelBreakdown.dineInOrders} orders
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-[var(--rep-ink)]">
                      {formatMoney(executive.channelBreakdown.dineInSalesMinor, currency)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-extrabold text-[var(--rep-ink)]">
                        Counter & Pickup
                      </div>
                      <div className="text-xs text-[var(--rep-muted)]">
                        {executive.channelBreakdown.pickupOrders} orders
                      </div>
                    </div>
                    <div className="text-sm font-extrabold text-[var(--rep-ink)]">
                      {formatMoney(executive.channelBreakdown.pickupSalesMinor, currency)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Contribution */}
              <div className="reports-panel">
                <div className="reports-panel-head">
                  <div className="reports-panel-title">
                    <h2>Category Revenue Mix</h2>
                    <p>Top category shares contributing to gross revenue.</p>
                  </div>
                </div>
                <SvgBarChart
                  data={menuEngineering.categoryShares.slice(0, 5)}
                  currency={currency}
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 2: MENU INTELLIGENCE ───────────────────────────────────── */}
        {activeTab === "menu" && (
          <div>
            <div className="reports-kpis-grid">
              <KpiMetricCard
                label="Total Items Sold"
                value={menuEngineering.totalItemsSold.toLocaleString()}
                subtext="Across all categories"
                icon={<UtensilsCrossed size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Menu Revenue"
                value={formatMoney(menuEngineering.totalMenuRevenueMinor, currency)}
                subtext="Culinary gross revenue"
                icon={<DollarSign size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Average Popularity"
                value={`${menuEngineering.averageItemPopularity} items`}
                subtext="Per active dish"
                icon={<Flame size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Star Dishes"
                value={`${menuEngineering.quadrants.stars.length} dishes`}
                subtext="High volume & revenue"
                icon={<TrendingUp size={18} aria-hidden="true" />}
              />
            </div>

            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Menu Engineering Kasavana-Smith Matrix</h2>
                  <p>
                    Strategic categorization of menu items based on sales volume and revenue
                    contribution.
                  </p>
                </div>
              </div>

              <MenuEngineeringMatrix report={menuEngineering} currency={currency} />
            </div>
          </div>
        )}

        {/* ─── TAB 3: THE TILL & SHIFTS ────────────────────────────────────── */}
        {activeTab === "till" && (
          <div>
            <div className="reports-kpis-grid">
              <KpiMetricCard
                label="Total Collected"
                value={formatMoney(tillReconciliation.totalCollectedMinor, currency)}
                subtext="Across all tenders"
                icon={<DollarSign size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Total Refunded"
                value={formatMoney(tillReconciliation.totalRefundedMinor, currency)}
                subtext={`${tillReconciliation.recentRefunds.length} refunds logged`}
                icon={<AlertCircle size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Net Cash Flow"
                value={formatMoney(tillReconciliation.netCashFlowMinor, currency)}
                subtext="Settled revenue"
                icon={<ShieldCheck size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Cash Variance"
                value={formatMoney(tillReconciliation.totalVarianceMinor, currency)}
                subtext="Counted vs Expected float"
                icon={<Receipt size={18} aria-hidden="true" />}
              />
            </div>

            {/* Shift Logs Table */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Shift & Register Reconciliation</h2>
                  <p>Cashier float balancing, drawer counts, and closing variances.</p>
                </div>
              </div>

              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Register</th>
                      <th>Cashier</th>
                      <th>Status</th>
                      <th>Opened</th>
                      <th>Float In</th>
                      <th>Expected</th>
                      <th>Counted</th>
                      <th>Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tillReconciliation.shifts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-[var(--rep-muted)] italic">
                          No closed or open shifts recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      tillReconciliation.shifts.map((s) => (
                        <tr key={s.shiftId}>
                          <td className="font-bold">{s.registerName}</td>
                          <td>{s.cashierName}</td>
                          <td>
                            <span
                              className={
                                s.state === "open" ? "reports-badge-open" : "reports-badge-closed"
                              }
                            >
                              {s.state.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {new Date(s.openedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td>{formatMoney(s.openingFloatMinor, currency)}</td>
                          <td>{formatMoney(s.expectedMinor, currency)}</td>
                          <td>{formatMoney(s.countedMinor, currency)}</td>
                          <td
                            className={
                              s.varianceMinor && s.varianceMinor !== 0
                                ? "font-extrabold text-amber-600 dark:text-amber-400"
                                : "text-[var(--rep-muted)]"
                            }
                          >
                            {formatMoney(s.varianceMinor, currency)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tenders Breakdown List */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Settlement Methods Breakdown</h2>
                  <p>Tenders accepted by volume and percentage share.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {tillReconciliation.tenders.map((t) => (
                  <div
                    key={t.method}
                    className="flex items-center justify-between rounded-xl border border-[var(--rep-line)] bg-[var(--rep-soft)] p-4"
                  >
                    <div>
                      <div className="text-sm font-extrabold text-[var(--rep-ink)]">{t.label}</div>
                      <div className="text-xs text-[var(--rep-muted)]">
                        {t.tenderCount} transactions ({t.percentage}%)
                      </div>
                    </div>
                    <div className="text-base font-extrabold text-[var(--rep-ink)]">
                      {formatMoney(t.amountMinor, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 4: KITCHEN VELOCITY ────────────────────────────────────── */}
        {activeTab === "kitchen" && (
          <div>
            <div className="reports-kpis-grid">
              <KpiMetricCard
                label="Tickets Completed"
                value={kitchenVelocity.totalTickets.toLocaleString()}
                subtext="Through the line"
                icon={<ChefHat size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Average Prep Time"
                value={formatMinutes(kitchenVelocity.avgPrepMinutes)}
                subtext="Ticket to ready"
                icon={<Clock size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="Median Turnaround"
                value={formatMinutes(kitchenVelocity.medianPrepMinutes)}
                subtext="Middle order duration"
                icon={<Flame size={18} aria-hidden="true" />}
              />
              <KpiMetricCard
                label="SLA Compliance"
                value={`${kitchenVelocity.sla.fastPct}%`}
                subtext="Completed under 12 mins"
                icon={<ShieldCheck size={18} aria-hidden="true" />}
              />
            </div>

            {/* Kitchen SLA Distribution */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Service SLA Compliance</h2>
                  <p>Speed distribution for order prep from ticket acceptance to completion.</p>
                </div>
              </div>

              <div className="sla-progress-track">
                <div
                  className="sla-seg-fast"
                  style={{ width: `${kitchenVelocity.sla.fastPct}%` }}
                />
                <div
                  className="sla-seg-standard"
                  style={{ width: `${kitchenVelocity.sla.standardPct}%` }}
                />
                <div
                  className="sla-seg-delayed"
                  style={{ width: `${kitchenVelocity.sla.delayedPct}%` }}
                />
              </div>

              <div className="flex flex-wrap justify-between gap-4 text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                  <span>
                    Fast (&lt; 12m): {kitchenVelocity.sla.fastCount} ({kitchenVelocity.sla.fastPct}
                    %)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
                  <span>
                    Standard (12-22m): {kitchenVelocity.sla.standardCount} (
                    {kitchenVelocity.sla.standardPct}%)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                  <span>
                    Delayed (&gt; 22m): {kitchenVelocity.sla.delayedCount} (
                    {kitchenVelocity.sla.delayedPct}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Station Workload Breakdown */}
            <div className="reports-panel">
              <div className="reports-panel-head">
                <div className="reports-panel-title">
                  <h2>Kitchen Station Load</h2>
                  <p>Volume and speed across individual culinary stations.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {kitchenVelocity.stations.map((st) => (
                  <div
                    key={st.stationId}
                    className="rounded-xl border border-[var(--rep-line)] bg-[var(--rep-soft)] p-4"
                  >
                    <div className="text-sm font-extrabold text-[var(--rep-ink)]">
                      {st.stationName}
                    </div>
                    <div className="mt-2 text-2xl font-black text-[var(--rep-ink)]">
                      {st.ticketsHandled}{" "}
                      <span className="text-xs font-normal text-[var(--rep-muted)]">tickets</span>
                    </div>
                    <div className="mt-1 text-xs font-bold text-[var(--rep-brand)]">
                      Avg speed: {formatMinutes(st.avgPrepMinutes)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── TAB 5: DAILY Z-REPORT ──────────────────────────────────────── */}
        {activeTab === "z-report" && (
          <div className="py-4">
            <ZReportPreview report={dailyZReport} />
          </div>
        )}
      </main>
    </div>
  );
}
