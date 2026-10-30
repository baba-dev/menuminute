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
      <div className="z-report-preview-toolbar flex items-center gap-3">
        <button type="button" onClick={handlePrint} className="reports-hero-primary">
          <Printer size={16} aria-hidden="true" />
          Print Daily Summary
        </button>
      </div>

      <p className="max-w-lg text-center text-xs font-semibold text-[var(--rep-muted)]">
        Live order summary only. Not a finalized Z-report, invoice or fiscal closeout.
      </p>
      {/* Printable provisional summary; no fiscal sequence or immutable sign-off. */}
      <div className="z-report-receipt w-full">
        <div className="z-receipt-header">
          <div className="text-[10px] tracking-widest text-[var(--rep-muted)] uppercase">
            Provisional Daily Order Summary
          </div>
          <h3>{report.outletName}</h3>
          <div className="text-[11px] text-[var(--rep-muted)]">
            {report.businessDate} · {report.reportNumber}
          </div>
          <div className="text-[10px] text-[var(--rep-muted)]">
            Generated:{" "}
            {new Date(report.generatedAt).toLocaleString("en-GB", { timeZone: report.timezone })} (
            {report.timezone})
          </div>
        </div>

        {/* Sales Summary */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── Sales & Covers ───
          </div>
          <div className="z-receipt-line">
            <span>Order requests:</span>
            <span>{report.orderCount}</span>
          </div>
          <div className="z-receipt-line">
            <span>Guest covers:</span>
            <span>{report.coversCount ?? "Not tracked"}</span>
          </div>
          <div className="z-receipt-line">
            <span>Eligible billed value:</span>
            <span>{formatMoney(report.grossSalesMinor, currency)}</span>
          </div>
          <div className="z-receipt-line">
            <span>Discounts:</span>
            <span>
              {report.discountsMinor === null
                ? "Not available"
                : formatMoney(report.discountsMinor, currency)}
            </span>
          </div>
          <div className="z-receipt-line">
            <span>Refunds:</span>
            <span>
              {report.refundsMinor === null
                ? "Restricted"
                : formatMoney(report.refundsMinor, currency)}
            </span>
          </div>
          <div className="z-receipt-line is-bold">
            <span>SALES BEFORE TAX (UNPAID INCLUDED):</span>
            <span>{formatMoney(report.netSalesMinor, currency)}</span>
          </div>
        </div>

        {/* Tax Breakdown */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── Order Tax (Not Settlement) ───
          </div>
          {report.taxBreakdown.map((t, idx) => (
            <div key={idx} className="z-receipt-line">
              <span>{t.rateLabel}:</span>
              <span>{formatMoney(t.taxMinor, currency)}</span>
            </div>
          ))}
          <div className="z-receipt-line font-bold">
            <span>Tax on Eligible Orders:</span>
            <span>{formatMoney(report.taxCollectedMinor, currency)}</span>
          </div>
        </div>

        {/* Tenders Summary */}
        <div className="mb-4">
          <div className="text-[10px] font-extrabold tracking-wider text-[var(--rep-muted)] uppercase">
            ─── POS Recorded Tenders ───
          </div>
          {!report.financeAvailable && <p>Settlement access restricted.</p>}
          {report.financeAvailable &&
            report.tenders.map((tender) => (
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

        <p className="mt-8 border-t border-dashed border-[#8b7361] pt-4 text-center text-[10px]">
          LIVE PREVIEW — NOT A FISCAL CLOSEOUT
        </p>
      </div>
    </div>
  );
}
