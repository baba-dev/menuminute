"use client";

import { formatMoney } from "@/modules/reports/formatters";
import type { CategorySalesShare } from "@/modules/reports/contracts";

export function SvgBarChart({ data, currency }: { data: CategorySalesShare[]; currency: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-[var(--rep-muted)]">
        No category revenue data available
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.revenueMinor), 1);

  return (
    <div className="flex flex-col gap-3 py-1">
      {data.map((item) => {
        const pct = Math.max(3, Math.round((item.revenueMinor / maxVal) * 100));
        return (
          <div key={item.categoryName} className="group flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--rep-ink)]">{item.categoryName}</span>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[var(--rep-muted)]">
                  {item.orderCount} sold ({item.percentageShare}%)
                </span>
                <span className="font-extrabold text-[var(--rep-ink)] tabular-nums">
                  {formatMoney(item.revenueMinor, currency)}
                </span>
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--rep-soft)]">
              <div
                className="h-full rounded-full bg-[var(--rep-brand)] transition-all duration-300 group-hover:brightness-110"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
