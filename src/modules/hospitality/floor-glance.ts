import type { FloorOverview, FloorTableOverview } from "./floor-contracts";

/** Order-derived money context for a table. Comes from the orders-only floor matrix. */
export type TableDue = { dueMinor: string; latestOrderId: string | null };

export type GlanceTable = {
  table: FloorTableOverview;
  tone: "free" | "busy" | "full";
  dueMinor: string;
  latestOrderId: string | null;
  /** Needs a person's attention: unpaid tab or a stale seating. */
  attention: boolean;
};

export type GlanceGroup = {
  id: string;
  name: string;
  color: string | null;
  tables: GlanceTable[];
};

export type GlanceAttention = {
  kind: "unpaid" | "stale";
  tableId: string;
  tableName: string;
  dueMinor: string;
  latestOrderId: string | null;
};

export type FloorGlance = {
  totals: { tables: number; tablesInUse: number; seats: number; seatsTaken: number };
  openOrders: number;
  unpaidTabs: number;
  fillPct: number;
  groups: GlanceGroup[];
  /** Tables beyond the display cap, shown as "+N more". */
  hiddenTables: number;
  attention: GlanceAttention[];
};

export const GLANCE_MAX_TABLES = 12;
export const GLANCE_MAX_ATTENTION = 3;

const rank = (t: FloorTableOverview) =>
  t.unpaidOrders > 0 ? 0 : t.stale ? 1 : t.activeOrders > 0 ? 2 : t.currentOccupancy > 0 ? 3 : 4;

/**
 * Pure view-model for the dashboard's miniature dining floor. Occupancy comes only from chair
 * state; orders and money are context. Nothing here claims physical occupancy.
 */
export function buildFloorGlance(
  overview: FloorOverview,
  dueByTable: ReadonlyMap<string, TableDue> | null,
  max = GLANCE_MAX_TABLES
): FloorGlance {
  const due = (id: string): TableDue =>
    dueByTable?.get(id) ?? { dueMinor: "0", latestOrderId: null };
  const { tables, totals } = overview;

  // Most attention-worthy tables first, then keep floor order (display number) within a rank.
  const shown = new Set(
    [...tables]
      .sort((a, b) => rank(a) - rank(b) || a.displayNumber - b.displayNumber)
      .slice(0, Math.max(0, max))
      .map((t) => t.id)
  );

  const toGlance = (t: FloorTableOverview): GlanceTable => ({
    table: t,
    tone: t.state === "full" ? "full" : t.state === "partial" ? "busy" : "free",
    ...due(t.id),
    attention: t.unpaidOrders > 0 || t.stale,
  });
  const visible = tables.filter((t) => shown.has(t.id));

  const sectionIds = new Set(overview.sections.map((s) => s.id));
  const groups: GlanceGroup[] = overview.sections
    .map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color as string | null,
      tables: visible.filter((t) => t.sectionId === s.id).map(toGlance),
    }))
    .filter((g) => g.tables.length > 0);
  const loose = visible.filter((t) => !t.sectionId || !sectionIds.has(t.sectionId));
  if (loose.length > 0)
    groups.push({
      id: "__none",
      name: overview.sections.length > 0 ? "No section" : "Tables",
      color: null,
      tables: loose.map(toGlance),
    });

  const attention: GlanceAttention[] = [...tables]
    .filter((t) => t.unpaidOrders > 0 || t.stale)
    .sort((a, b) => rank(a) - rank(b) || a.displayNumber - b.displayNumber)
    .slice(0, GLANCE_MAX_ATTENTION)
    .map((t) => ({
      kind: t.unpaidOrders > 0 ? ("unpaid" as const) : ("stale" as const),
      tableId: t.id,
      tableName: t.name,
      ...due(t.id),
    }));

  return {
    totals: {
      tables: totals.tables,
      tablesInUse: totals.tablesOccupied,
      seats: totals.maxOccupancy,
      seatsTaken: totals.currentOccupancy,
    },
    openOrders: tables.reduce((n, t) => n + t.activeOrders, 0),
    unpaidTabs: tables.reduce((n, t) => n + t.unpaidOrders, 0),
    fillPct: totals.maxOccupancy
      ? Math.round((totals.currentOccupancy / totals.maxOccupancy) * 100)
      : 0,
    groups,
    hiddenTables: Math.max(0, tables.length - visible.length),
    attention,
  };
}

/** Plain-language summary of one table for aria-labels and tooltips. */
export function describeGlanceTable(g: GlanceTable, formatMoney: (minor: string) => string) {
  const t = g.table;
  const parts = [
    t.maxOccupancy === 0
      ? "no chairs yet"
      : `${t.currentOccupancy} of ${t.maxOccupancy} seats taken`,
  ];
  if (t.activeOrders > 0) parts.push(`${t.activeOrders} open`);
  if (t.unpaidOrders > 0)
    parts.push(
      g.dueMinor !== "0"
        ? `${t.unpaidOrders} unpaid, due ${formatMoney(g.dueMinor)}`
        : `${t.unpaidOrders} unpaid`
    );
  return `${t.name}: ${parts.join(", ")}`;
}
