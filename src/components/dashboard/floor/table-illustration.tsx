"use client";

import type { KeyboardEvent } from "react";
import type { FloorChair, FloorTableOverview } from "@/modules/hospitality/floor-contracts";
import { layoutTable } from "./table-geometry";
import styles from "./floor.module.css";

const KIND_LABEL: Record<FloorChair["kind"], string> = {
  standard: "chair",
  high_chair: "high chair",
  bar_stool: "bar stool",
  accessible: "accessible seat",
};

/**
 * The table and its real chairs. Every chair is a button: tap to toggle it taken/free.
 * Tapping the table itself opens the "seat a party" prompt.
 */
export function TableIllustration({
  table,
  canSeat,
  pendingChairIds,
  onChairToggle,
  onTableTap,
}: {
  table: FloorTableOverview;
  canSeat: boolean;
  pendingChairIds: ReadonlySet<string>;
  onChairToggle: (chair: FloorChair) => void;
  onTableTap: () => void;
}) {
  const g = layoutTable(table.shape, table.chairs.length);
  const tone = table.state === "full" ? "full" : table.state === "partial" ? "busy" : "free";
  const press = (action: () => void) => (event: KeyboardEvent<SVGElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      action();
    }
  };
  const centre =
    g.top.kind === "ellipse"
      ? { x: g.top.cx, y: g.top.cy }
      : { x: g.top.x + g.top.w / 2, y: g.top.y + g.top.h / 2 };

  return (
    <svg
      className={styles.illustration}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="group"
      aria-label={`${table.name}, ${table.currentOccupancy} of ${table.maxOccupancy} seats taken`}
    >
      {g.bench && (
        <rect
          className={styles.tableTop}
          x={g.bench.x}
          y={g.bench.y}
          width={g.bench.w}
          height={g.bench.h}
          rx={9}
          data-state="free"
        />
      )}
      {g.top.kind === "ellipse" ? (
        <ellipse
          className={styles.tableTop}
          data-state={tone}
          cx={g.top.cx}
          cy={g.top.cy}
          rx={g.top.rx}
          ry={g.top.ry}
        />
      ) : (
        <rect
          className={styles.tableTop}
          data-state={tone}
          x={g.top.x}
          y={g.top.y}
          width={g.top.w}
          height={g.top.h}
          rx={g.top.r}
        />
      )}
      <text className={styles.tableLabel} x={centre.x} y={centre.y + 2}>
        {table.displayNumber}
      </text>
      <text className={styles.tableLabelSmall} x={centre.x} y={centre.y + 20}>
        {table.chairs.length > 0
          ? `${table.currentOccupancy}/${table.maxOccupancy} seated`
          : "no chairs"}
      </text>
      {canSeat && table.chairs.length > 0 && (
        <rect
          className={styles.tableTopHit}
          x={g.top.kind === "ellipse" ? g.top.cx - g.top.rx : g.top.x}
          y={g.top.kind === "ellipse" ? g.top.cy - g.top.ry : g.top.y}
          width={g.top.kind === "ellipse" ? g.top.rx * 2 : g.top.w}
          height={g.top.kind === "ellipse" ? g.top.ry * 2 : g.top.h}
          rx={g.top.kind === "ellipse" ? g.top.rx : g.top.r}
          role="button"
          tabIndex={0}
          aria-label={`${table.name}, seat or clear guests`}
          onClick={onTableTap}
          onKeyDown={press(onTableTap)}
        />
      )}
      {table.chairs.map((chair, i) => {
        const slot = g.slots[i];
        if (!slot) return null;
        const pending = pendingChairIds.has(chair.id);
        const name = `${chair.label ?? `Chair ${i + 1}`}, ${KIND_LABEL[chair.kind]}`;
        const toggle = () => canSeat && !pending && onChairToggle(chair);
        return (
          <g
            key={chair.id}
            className={styles.chair}
            transform={`translate(${slot.x} ${slot.y}) rotate(${slot.rotation})`}
            data-occupied={chair.occupied}
            data-pending={pending}
            role="button"
            tabIndex={canSeat ? 0 : -1}
            aria-pressed={chair.occupied}
            aria-disabled={!canSeat}
            aria-label={`${table.name}, ${name}, ${chair.occupied ? "taken" : "free"}`}
            onClick={toggle}
            onKeyDown={press(toggle)}
          >
            <title>{`${name} · ${chair.occupied ? "taken" : "free"}`}</title>
            <path className={styles.chairBack} d="M -13 -12 C -9 -17, 9 -17, 13 -12" />
            <rect className={styles.chairSeat} x={-11} y={-10} width={22} height={20} rx={6} />
          </g>
        );
      })}
    </svg>
  );
}
