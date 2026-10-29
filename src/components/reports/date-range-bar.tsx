"use client";

import { useEffect, useState } from "react";
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
  const [from, setFrom] = useState(query.from ?? "");
  const [to, setTo] = useState(query.to ?? "");

  useEffect(() => {
    setFrom(query.from ?? "");
    setTo(query.to ?? "");
  }, [query.from, query.to]);

  const presets: { id: ReportRange; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "yesterday", label: "Yesterday" },
    { id: "7d", label: "Last 7 Days" },
    { id: "month", label: "This Month" },
    { id: "30d", label: "Last 30 Days" },
  ];
  const days = (Date.parse(to) - Date.parse(from)) / 86400000;
  const valid =
    from.length === 10 && to.length === 10 && Number.isFinite(days) && days >= 0 && days <= 366;

  return (
    <div className="reports-filter-strip" aria-label="Report filters">
      <div className="reports-preset-group">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ range: p.id, from: undefined, to: undefined })}
            className={`reports-preset-btn ${query.range === p.id ? "is-active" : ""}`}
            aria-pressed={query.range === p.id}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="reports-custom-range">
        <label>
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="reports-preset-btn"
          disabled={!valid}
          onClick={() => onChange({ range: "custom", from, to })}
        >
          Apply dates
        </button>
      </div>
      <div className="reports-filter-tail">
        <span className="text-xs font-semibold text-[var(--rep-muted)]">
          <strong className="text-[var(--rep-ink)]">{dateLabel}</strong>
        </span>
        <select
          value={query.fulfillmentMode}
          disabled={query.tab === "till" || query.tab === "z-report"}
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
