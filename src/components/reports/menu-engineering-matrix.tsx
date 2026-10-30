"use client";

import { useState } from "react";
import { Star, Sparkles, TrendingDown, Info } from "lucide-react";
import { formatMoney } from "@/modules/reports/formatters";
import type { MenuEngineeringReport, MenuEngineeringItem } from "@/modules/reports/contracts";

export function MenuEngineeringMatrix({
  report,
  currency,
}: {
  report: MenuEngineeringReport;
  currency: string;
}) {
  const [selectedDish, setSelectedDish] = useState<MenuEngineeringItem | null>(null);

  const quadrants = [
    {
      id: "star" as const,
      name: "Stars (High Volume · High Revenue)",
      items: report.quadrants.stars,
      className: "is-star",
      icon: <Star size={16} aria-hidden="true" />,
      tagline: "Your flagship crowd-pleasers. Keep recipe & quality strictly consistent.",
    },
    {
      id: "plowhorse" as const,
      name: "Plowhorses (High Volume · Lower Revenue)",
      items: report.quadrants.plowhorses,
      className: "is-plowhorse",
      icon: <Sparkles size={16} aria-hidden="true" />,
      tagline: "Popular dishes; validate contribution costs before making price changes.",
    },
    {
      id: "puzzle" as const,
      name: "Puzzles (Lower Volume · High Revenue)",
      items: report.quadrants.puzzles,
      className: "is-puzzle",
      icon: <Info size={16} aria-hidden="true" />,
      tagline: "Higher revenue dishes with lower demand. Validate costs before claiming profit.",
    },
    {
      id: "dog" as const,
      name: "Underperformers (Lower Volume · Lower Revenue)",
      items: report.quadrants.dogs,
      className: "is-dog",
      icon: <TrendingDown size={16} aria-hidden="true" />,
      tagline: "Lower observed sales; confirm sample size before changing the menu.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 2x2 Quadrant Grid */}
      <div className="matrix-grid">
        {quadrants.map((q) => (
          <div key={q.id} className={`matrix-quadrant ${q.className}`}>
            <div className="matrix-quadrant-head">
              <span className="matrix-quadrant-title">
                {q.icon}
                {q.name}
              </span>
              <span className="text-xs font-bold opacity-75">{q.items.length} dishes</span>
            </div>
            <p className="mb-3 text-[11px] opacity-80">{q.tagline}</p>

            <div className="matrix-item-list">
              {q.items.length === 0 ? (
                <div className="flex h-20 items-center justify-center text-[11px] italic opacity-60">
                  No items currently in this quadrant
                </div>
              ) : (
                q.items.slice(0, 5).map((dish) => (
                  <button
                    key={dish.dishId}
                    type="button"
                    onClick={() => setSelectedDish(dish)}
                    className="matrix-item-row w-full text-left transition hover:scale-[1.01]"
                  >
                    <div>
                      <div className="matrix-item-name">{dish.name}</div>
                      <div className="matrix-item-meta">
                        {dish.quantitySold} sold ({dish.popularitySharePct}%) · {dish.categoryName}
                      </div>
                    </div>
                    <div className="matrix-item-rev">
                      {formatMoney(dish.totalRevenueMinor, currency)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Dish Deep Dive Card */}
      {selectedDish && (
        <div className="rounded-xl border border-[var(--rep-line)] bg-[var(--rep-card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold tracking-wider text-[var(--rep-brand)] uppercase">
                {selectedDish.quadrant.toUpperCase()} DISH STRATEGY
              </span>
              <h4 className="text-base font-extrabold text-[var(--rep-ink)]">
                {selectedDish.name}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDish(null)}
              className="rounded-md border border-[var(--rep-line)] px-2 py-1 text-xs font-bold text-[var(--rep-muted)] hover:bg-[var(--rep-soft)]"
            >
              Dismiss
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-[var(--rep-ink)]">
            💡 <strong>Recommendation:</strong> {selectedDish.recommendation}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            <div>
              <span className="text-[var(--rep-muted)]">Unit Price: </span>
              <strong className="font-bold text-[var(--rep-ink)]">
                {formatMoney(selectedDish.unitPriceMinor, currency)}
              </strong>
            </div>
            <div>
              <span className="text-[var(--rep-muted)]">Units Sold: </span>
              <strong className="font-bold text-[var(--rep-ink)]">
                {selectedDish.quantitySold}
              </strong>
            </div>
            <div>
              <span className="text-[var(--rep-muted)]">Total Revenue: </span>
              <strong className="font-bold text-[var(--rep-ink)]">
                {formatMoney(selectedDish.totalRevenueMinor, currency)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
