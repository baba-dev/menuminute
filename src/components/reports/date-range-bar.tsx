"use client";

import type { ReportQuery, ReportRange } from "@/modules/reports/contracts";

export function DateRangeBar({
  query,
  dateLabel,
  onChange,
}: {
  query: ReportQuery;
  dateLabel: string;
  onChange: (updates: Partial<ReportQuery>) => void;
}) {
  const presets: { id: ReportRange; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 Days" },
    { id: "month", label: "This Month" },
    { id: "30d", label: "Last 30 Days" },
  ];

  return (
    <div className="reports-filter-strip">
      <div className="reports-preset-group">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ range: p.id })}
            className={`reports-preset-btn ${query.range === p.id ? "is-active" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-[var(--rep-muted)]">
          Range: <strong className="text-[var(--rep-ink)]">{dateLabel}</strong>
        </span>

        <select
          value={query.fulfillmentMode}
          onChange={(e) =>
            onChange({ fulfillmentMode: e.target.value as "all" | "dine_in" | "pickup" })
          }
          className="reports-mode-select"
          aria-label="Filter fulfillment channel"
        >
          <option value="all">All Channels</option>
          <option value="dine_in">Dine-in Only</option>
          <option value="pickup">Pickup Only</option>
        </select>
      </div>
    </div>
  );
}
