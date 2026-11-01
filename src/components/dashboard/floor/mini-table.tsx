import type { FloorTableOverview } from "@/modules/hospitality/floor-contracts";
import { layoutTable } from "./table-geometry";
import styles from "./floor-glance.module.css";

/**
 * A small, read-only twin of the floor page's table illustration for the dashboard widget.
 * It reuses the same geometry so shapes and chair positions match the real floor, but it has
 * no handlers: the surrounding link opens the dining floor page.
 */
export function MiniTable({
  table,
  tone,
  label,
}: {
  table: FloorTableOverview;
  tone: "free" | "busy" | "full";
  label: string;
}) {
  const g = layoutTable(table.shape, table.chairs.length);
  const centre =
    g.top.kind === "ellipse"
      ? { x: g.top.cx, y: g.top.cy }
      : { x: g.top.x + g.top.w / 2, y: g.top.y + g.top.h / 2 };

  return (
    <svg
      className={styles.mini}
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={label}
      focusable="false"
    >
      {g.bench && (
        <rect
          className={styles.top}
          data-state="free"
          x={g.bench.x}
          y={g.bench.y}
          width={g.bench.w}
          height={g.bench.h}
          rx={9}
        />
      )}
      {g.top.kind === "ellipse" ? (
        <ellipse
          className={styles.top}
          data-state={tone}
          cx={g.top.cx}
          cy={g.top.cy}
          rx={g.top.rx}
          ry={g.top.ry}
        />
      ) : (
        <rect
          className={styles.top}
          data-state={tone}
          x={g.top.x}
          y={g.top.y}
          width={g.top.w}
          height={g.top.h}
          rx={g.top.r}
        />
      )}
      <text className={styles.num} x={centre.x} y={centre.y} dominantBaseline="central">
        {table.displayNumber}
      </text>
      {table.chairs.map((chair, i) => {
        const slot = g.slots[i];
        if (!slot) return null;
        return (
          <g
            key={chair.id}
            className={styles.seat}
            data-occupied={chair.occupied}
            transform={`translate(${slot.x} ${slot.y}) rotate(${slot.rotation})`}
          >
            <path className={styles.seatBack} d="M -13 -12 C -9 -17, 9 -17, 13 -12" />
            <rect className={styles.seatBase} x={-11} y={-10} width={22} height={20} rx={6} />
          </g>
        );
      })}
    </svg>
  );
}
