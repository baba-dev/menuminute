import type { ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ComparisonDelta } from "@/modules/reports/contracts";

export function KpiMetricCard({
  label,
  value,
  subtext,
  delta,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  delta?: ComparisonDelta;
  icon: ReactNode;
}) {
  return (
    <div className="reports-kpi-card">
      <div>
        <div className="reports-kpi-top">
          <span className="reports-kpi-label">{label}</span>
          <span className="reports-kpi-icon">{icon}</span>
        </div>
        <div className="reports-kpi-value">{value}</div>
      </div>

      <div className="reports-kpi-bottom">
        {delta && delta.percentageChange != null ? (
          <span
            className={
              "reports-delta-badge " +
              (delta.direction === "up"
                ? "is-up"
                : delta.direction === "down"
                  ? "is-down"
                  : "is-flat")
            }
          >
            {delta.direction === "up" && <TrendingUp size={12} aria-hidden="true" />}
            {delta.direction === "down" && <TrendingDown size={12} aria-hidden="true" />}
            {delta.direction === "flat" && <Minus size={12} aria-hidden="true" />}
            <span>
              {delta.direction === "up" ? "+" : ""}
              {delta.percentageChange}%
            </span>
          </span>
        ) : null}
        {subtext && <span className="truncate">{subtext}</span>}
      </div>
    </div>
  );
}
