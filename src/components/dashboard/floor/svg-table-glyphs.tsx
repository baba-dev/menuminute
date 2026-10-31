"use client";

import React from "react";
import type { VisualTable, TableLiveStatus } from "@/modules/hospitality/floor-contracts";

interface TableGlyphProps {
  table: VisualTable;
  status?: TableLiveStatus;
  selected?: boolean;
  hovered?: boolean;
  onSelect?: (table: VisualTable) => void;
  onHover?: (table: VisualTable | null) => void;
}

/**
 * Parametric SVG Chair Glyph.
 * Placed along table perimeter, rotated toward table center.
 */
function ChairGlyph({
  x,
  y,
  rotation,
  themeClass = "mm-chair-normal",
}: {
  x: number;
  y: number;
  rotation: number;
  themeClass?: string;
}) {
  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      className={`mm-svg-chair ${themeClass}`}
    >
      {/* Curved backrest */}
      <path
        d="M -11 -7 C -8 -11, 8 -11, 11 -7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Seat cushion */}
      <rect x="-9" y="-6" width="18" height="12" rx="3.5" fill="currentColor" opacity="0.85" />
    </g>
  );
}

/**
 * Bar Stool Glyph for bar counters
 */
function BarStoolGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x}, ${y})`} className="mm-svg-chair mm-chair-normal">
      <circle cx="0" cy="0" r="9" fill="currentColor" opacity="0.9" />
      <circle cx="0" cy="0" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle
        cx="0"
        cy="0"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
    </g>
  );
}

/**
 * Computes chairs positioned radially around a round table.
 */
function calculateRadialChairs(cx: number, cy: number, radius: number, count: number) {
  const chairs = [];
  const offsetDistance = radius + 15;
  for (let i = 0; i < count; i++) {
    const angleRad = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = cx + offsetDistance * Math.cos(angleRad);
    const y = cy + offsetDistance * Math.sin(angleRad);
    const rotationDeg = (angleRad * 180) / Math.PI + 90;
    chairs.push({ x, y, rotation: rotationDeg });
  }
  return chairs;
}

/**
 * Computes chairs along perimeter edges of a rectangular or square table.
 */
function calculateRectChairs(w: number, h: number, count: number) {
  const chairs = [];
  const cx = w / 2;
  const cy = h / 2;
  const offset = 14;

  if (count <= 2) {
    // 1 on top, 1 on bottom
    chairs.push({ x: cx, y: -offset, rotation: 180 });
    if (count === 2) chairs.push({ x: cx, y: h + offset, rotation: 0 });
    return chairs;
  }

  if (count === 4) {
    // 1 chair per edge
    chairs.push({ x: cx, y: -offset, rotation: 180 }); // Top
    chairs.push({ x: w + offset, y: cy, rotation: 270 }); // Right
    chairs.push({ x: cx, y: h + offset, rotation: 0 }); // Bottom
    chairs.push({ x: -offset, y: cy, rotation: 90 }); // Left
    return chairs;
  }

  // General distribution: divide between top and bottom sides first
  const sideCount = Math.floor(count / 2);
  const remainder = count % 2;

  // Top edge
  const topCount = sideCount;
  for (let i = 0; i < topCount; i++) {
    const x = (w / (topCount + 1)) * (i + 1);
    chairs.push({ x, y: -offset, rotation: 180 });
  }

  // Bottom edge
  const bottomCount = sideCount;
  for (let i = 0; i < bottomCount; i++) {
    const x = (w / (bottomCount + 1)) * (i + 1);
    chairs.push({ x, y: h + offset, rotation: 0 });
  }

  // If odd chair remaining, put on left or right end
  if (remainder > 0) {
    chairs.push({ x: w + offset, y: cy, rotation: 270 });
  }

  return chairs;
}

export function TableGlyph({
  table,
  status,
  selected = false,
  hovered = false,
  onSelect,
  onHover,
}: TableGlyphProps) {
  const { shape, width: w, height: h, capacity } = table;
  const state = status?.state ?? "available";

  // Derive chair coordinates according to table shape
  const chairs = React.useMemo(() => {
    if (shape === "round") {
      const r = Math.min(w, h) / 2;
      return calculateRadialChairs(w / 2, h / 2, r, capacity);
    }
    if (shape === "bar") {
      // Linear stools along the bottom edge
      const items = [];
      const count = Math.max(1, capacity);
      for (let i = 0; i < count; i++) {
        const x = (w / (count + 1)) * (i + 1);
        items.push({ x, y: h + 18, rotation: 0 });
      }
      return items;
    }
    return calculateRectChairs(w, h, capacity);
  }, [shape, w, h, capacity]);

  const stateClass = `mm-state-${state}`;

  return (
    <g
      id={`table-glyph-${table.id}`}
      transform={`translate(${table.x}, ${table.y}) rotate(${table.rotation || 0}, ${w / 2}, ${h / 2})`}
      className={`mm-table-group ${stateClass} ${selected ? "is-selected" : ""} ${hovered ? "is-hovered" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`Table ${table.tableNumber}, ${capacity} seats, ${table.label ?? "Service table"}, Status: ${state}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(table);
      }}
      onMouseEnter={() => onHover?.(table)}
      onMouseLeave={() => onHover?.(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(table);
        }
      }}
    >
      {/* 1. Status Halo Ring (if active or alert) */}
      {state === "active" && (
        <rect
          x="-8"
          y="-8"
          width={w + 16}
          height={h + 16}
          rx={shape === "round" ? (w + 16) / 2 : 12}
          className="mm-halo-active"
        />
      )}
      {state === "unpaid" && (
        <rect
          x="-8"
          y="-8"
          width={w + 16}
          height={h + 16}
          rx={shape === "round" ? (w + 16) / 2 : 12}
          className="mm-halo-unpaid"
        />
      )}
      {state === "reserved" && (
        <rect
          x="-8"
          y="-8"
          width={w + 16}
          height={h + 16}
          rx={shape === "round" ? (w + 16) / 2 : 12}
          className="mm-halo-reserved"
        />
      )}

      {/* 2. Chairs surrounding the table */}
      <g className="mm-chairs-layer" aria-hidden="true">
        {shape === "bar"
          ? chairs.map((c, idx) => <BarStoolGlyph key={idx} x={c.x} y={c.y} />)
          : chairs.map((c, idx) => (
              <ChairGlyph
                key={idx}
                x={c.x}
                y={c.y}
                rotation={c.rotation}
                themeClass={`mm-chair-${state}`}
              />
            ))}
      </g>

      {/* 3. Table Surface Body */}
      {shape === "round" && (
        <circle
          cx={w / 2}
          cy={h / 2}
          r={Math.min(w, h) / 2}
          className="mm-table-surface mm-table-round"
        />
      )}

      {shape === "square" && (
        <rect
          x="0"
          y="0"
          width={w}
          height={h}
          rx="8"
          className="mm-table-surface mm-table-square"
        />
      )}

      {shape === "rectangle" && (
        <rect x="0" y="0" width={w} height={h} rx="10" className="mm-table-surface mm-table-rect" />
      )}

      {shape === "booth" && (
        <g className="mm-table-booth-group">
          {/* Outer high-back padded booth wall */}
          <rect x="-6" y="-6" width={w + 12} height={h + 12} rx="12" className="mm-booth-wall" />
          {/* Interior dining surface */}
          <rect
            x="0"
            y="0"
            width={w}
            height={h}
            rx="8"
            className="mm-table-surface mm-table-booth"
          />
        </g>
      )}

      {shape === "bar" && (
        <g className="mm-table-bar-group">
          <rect x="0" y="0" width={w} height={h} rx="6" className="mm-table-surface mm-table-bar" />
          {/* Wood rail accent along top */}
          <rect x="0" y="0" width={w} height="8" rx="3" className="mm-bar-rail" />
        </g>
      )}

      {/* 4. Table Center Identity & Badge */}
      <g className="mm-table-label-group" pointerEvents="none">
        <text
          x={w / 2}
          y={h / 2 - 4}
          textAnchor="middle"
          dominantBaseline="central"
          className="mm-table-number"
        >
          {table.tableNumber}
        </text>
        <text
          x={w / 2}
          y={h / 2 + 13}
          textAnchor="middle"
          dominantBaseline="central"
          className="mm-table-cap"
        >
          {table.capacity}p
        </text>
      </g>

      {/* 5. Service Bell Request Alert Icon (if active) */}
      {status?.hasServiceRequest && (
        <g transform={`translate(${w - 12}, -10)`} className="mm-bell-indicator">
          <circle cx="0" cy="0" r="11" className="mm-bell-bg" />
          <path
            d="M -5 3 C -5 0, 5 0, 5 3 L 6 4 L -6 4 Z M -1 6 C 0 7, 1 7, 2 6"
            fill="currentColor"
            stroke="none"
          />
        </g>
      )}

      {/* 6. Unpaid Due Badge (if unpaid orders) */}
      {status?.unpaidOrders && status.unpaidOrders > 0 ? (
        <g transform={`translate(10, -10)`} className="mm-unpaid-badge">
          <rect x="-8" y="-9" width="34" height="18" rx="5" className="mm-unpaid-bg" />
          <text
            x="9"
            y="1"
            textAnchor="middle"
            dominantBaseline="central"
            className="mm-unpaid-text"
          >
            DUE
          </text>
        </g>
      ) : null}

      {/* 7. QR Active Indicator */}
      {status?.qrCode?.isActive && (
        <g transform={`translate(${w - 10}, ${h - 10})`} className="mm-qr-badge">
          <title>Permanent QR Active</title>
          <circle cx="0" cy="0" r="7" className="mm-qr-dot" />
        </g>
      )}
    </g>
  );
}
