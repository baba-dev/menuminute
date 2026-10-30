"use client";

import { useState, useId } from "react";
import { formatMoney } from "@/modules/reports/formatters";
import type { HourlyTrajectoryPoint } from "@/modules/reports/contracts";

export function SvgAreaChart({
  data,
  currency,
}: {
  data: HourlyTrajectoryPoint[];
  currency: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const gradientId = useId();

  if (!data || data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-[var(--rep-muted)]">
        No hourly sales data for this period
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.salesMinor, d.benchmarkMinor)),
    1000 // default minimum scale if empty
  );

  const width = 800;
  const height = 220;
  const paddingX = 24;
  const paddingY = 24;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingY * 2;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * chartW;
    const y = paddingY + chartH - (d.salesMinor / maxVal) * chartH;
    const benchY = paddingY + chartH - (d.benchmarkMinor / maxVal) * chartH;
    return { x, y, benchY, ...d };
  });

  // Build smooth cubic Bézier curve for actual sales
  let pathD = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1]! : points[0]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = i < points.length - 2 ? points[i + 2]! : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1]!.x} ${paddingY + chartH} L ${points[0]!.x} ${paddingY + chartH} Z`;

  // Build benchmark line
  let benchD = `M ${points[0]!.x} ${points[0]!.benchY}`;
  for (let i = 1; i < points.length; i++) {
    benchD += ` L ${points[i]!.x} ${points[i]!.benchY}`;
  }

  const activePoint = hoveredIdx != null ? points[hoveredIdx] : null;

  return (
    <div className="relative w-full">
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-60 w-full overflow-visible"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--rep-brand)" stopOpacity="0.35" />
              <stop offset="85%" stopColor="var(--rep-brand)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = paddingY + chartH * (1 - ratio);
            return (
              <line
                key={ratio}
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="var(--rep-line)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            );
          })}

          {/* Benchmark Line (prior period average) */}
          <path
            d={benchD}
            fill="none"
            stroke="#9ca3af"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Primary Trend Line */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--rep-brand)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Data Points & Hover Targets */}
          {points.map((p, i) => (
            <g key={i} className="cursor-pointer" onMouseEnter={() => setHoveredIdx(i)}>
              {/* Invisible wide hit area */}
              <rect
                x={p.x - chartW / (data.length * 2)}
                y={0}
                width={chartW / data.length}
                height={height}
                fill="transparent"
              />
              {/* Circle dot on hover */}
              {hoveredIdx === i && (
                <>
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={paddingY + chartH}
                    stroke="var(--rep-brand)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    fill="var(--rep-card)"
                    stroke="var(--rep-brand)"
                    strokeWidth="3"
                  />
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {activePoint && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-[var(--rep-line)] bg-[var(--rep-card)] px-3 py-2 text-xs shadow-md"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100 - 8}%`,
            }}
          >
            <div className="font-extrabold text-[var(--rep-ink)]">{activePoint.label}</div>
            <div className="mt-1 flex items-center gap-2 font-bold text-[var(--rep-brand)]">
              <span>Sales:</span>
              <span>{formatMoney(activePoint.salesMinor, currency)}</span>
            </div>
            <div className="text-[11px] text-[var(--rep-muted)]">
              {activePoint.orderCount} orders · Benchmark:{" "}
              {formatMoney(activePoint.benchmarkMinor, currency)}
            </div>
          </div>
        )}
      </div>

      {/* X-Axis Labels */}
      <div className="mt-2 flex justify-between px-3 text-[11px] font-semibold text-[var(--rep-muted)]">
        <span>00:00</span>
        <span>04:00</span>
        <span>08:00</span>
        <span>12:00</span>
        <span>16:00</span>
        <span>20:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}
