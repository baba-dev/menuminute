"use client";

import { Printer } from "lucide-react";
import { formatMoney } from "@/modules/reports/formatters";
import type { DailyZReportData } from "@/modules/reports/contracts";

export function ZReportPreview({ report }: { report: DailyZReportData }) {
  const currency = report.currency;

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={handlePrint} className="reports-hero-primary">
          <Printer size={16} aria-hidden="true" />
          Print Daily Z-Report
        </button>
      </div>

      {/* 80mm Thermal Receipt Simulation */}
      <div className="z-report-receipt w-full">
        <div className="z-receipt-header">
          <div className="text-[10px] tracking-widest text-[var(--rep-muted)] uppercase">
            End of Day Register Audit
          </div>
          <h3>{report.outletName}</h3>
          <div className="text-[11px] text-[var(--rep-muted)]">
            {report.businessDate} · {report.reportNumber}
          </div>
          <div className="text-[10px] text-[var(--rep-muted)]">
            Generated: {new Date(report.generatedAt).toLocaleTimeString()} ({report.timezone})
          </div>
        </div>

        {/* Sales Summary */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── Sales & Covers ───
          </div>
          <div className="z-receipt-line">
            <span>Total Orders:</span>
            <span>{report.orderCount}</span>
          </div>
          <div className="z-receipt-line">
            <span>Total Covers / Items:</span>
            <span>{report.coversCount}</span>
          </div>
          <div className="z-receipt-line">
            <span>Gross Sales:</span>
            <span>{formatMoney(report.grossSalesMinor, currency)}</span>
          </div>
          <div className="z-receipt-line">
            <span>Discounts & Voids:</span>
            <span>- {formatMoney(report.discountsMinor, currency)}</span>
          </div>
          <div className="z-receipt-line">
            <span>Refunds:</span>
            <span>- {formatMoney(report.refundsMinor, currency)}</span>
          </div>
          <div className="z-receipt-line is-bold">
            <span>NET COLLECTED SALES:</span>
            <span>{formatMoney(report.netSalesMinor, currency)}</span>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── Tax Liability ───
          </div>
          {report.taxBreakdown.map((t, idx) => (
            <div key={idx} className="z-receipt-line">
              <span>{t.rateLabel}:</span>
              <span>{formatMoney(t.taxMinor, currency)}</span>
            </div>
          ))}
          <div className="z-receipt-line font-bold">
            <span>Total Tax Collected:</span>
            <span>{formatMoney(report.taxCollectedMinor, currency)}</span>
          </div>
        </div>

        {/* Tenders Summary */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── Settlement Methods ───
          </div>
          {report.tenders.map((tender) => (
            <div key={tender.method} className="z-receipt-line">
              <span>
                {tender.label} ({tender.tenderCount}):
              </span>
              <span>{formatMoney(tender.amountMinor, currency)}</span>
            </div>
          ))}
        </div>

        {/* Top 5 Dishes */}
        {report.topDishes.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
              ─── Top Dishes ───
            </div>
            {report.topDishes.map((dish, i) => (
              <div key={i} className="z-receipt-line text-[11px]">
                <span className="max-w-[200px] truncate">
                  {dish.name} (x{dish.quantity})
                </span>
                <span>{formatMoney(dish.totalMinor, currency)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Sign Off Lines */}
        <div className="mt-8 border-t border-dashed border-[#8b7361] pt-6 text-[10px]">
          <div className="mb-6 flex justify-between">
            <span>Cashier Sign: ________________</span>
          </div>
          <div className="flex justify-between">
            <span>Manager Sign: ________________</span>
          </div>
          <div className="mt-4 text-center text-[9px] text-[var(--rep-muted)]">
            *** END OF FINANCIAL CLOSURE ***
          </div>
        </div>
      </div>
    </div>
  );
}
