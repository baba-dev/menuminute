import type {
  FloorChair,
  FloorOverview,
  FloorTableOverview,
} from "@/modules/hospitality/floor-contracts";

/** Recompute everything derived from chairs, so optimistic edits always keep the totals honest. */
export function recomputeOverview(overview: FloorOverview): FloorOverview {
  const tables = overview.tables.map<FloorTableOverview>((t) => {
    const taken = t.chairs.filter((c) => c.occupied).length;
    return {
      ...t,
      maxOccupancy: t.chairs.length,
      currentOccupancy: taken,
      state:
        t.chairs.length === 0
          ? "no_chairs"
          : taken === 0
            ? "empty"
            : taken === t.chairs.length
              ? "full"
              : "partial",
    };
  });
  const maxOccupancy = tables.reduce((n, t) => n + t.maxOccupancy, 0);
  return {
    ...overview,
    tables,
    totals: {
      ...overview.totals,
      tables: tables.length,
      chairs: maxOccupancy,
      maxOccupancy,
      currentOccupancy: tables.reduce((n, t) => n + t.currentOccupancy, 0),
      tablesOccupied: tables.filter((t) => t.currentOccupancy > 0).length,
      sections: overview.sections.length,
    },
  };
}

/** Apply one chair's state (optimistically, or from a server acknowledgement). */
export function withChair(
  overview: FloorOverview,
  chairId: string,
  patch: Partial<Pick<FloorChair, "occupied" | "version">>
): FloorOverview {
  const edit = (c: FloorChair): FloorChair =>
    c.id === chairId
      ? {
          ...c,
          ...patch,
          occupiedAt:
            patch.occupied === undefined
              ? c.occupiedAt
              : patch.occupied
                ? (c.occupiedAt ?? new Date().toISOString())
                : null,
        }
      : c;
  return recomputeOverview({
    ...overview,
    tables: overview.tables.map((t) => ({ ...t, chairs: t.chairs.map(edit) })),
  });
}

/** Tables grouped for display: one group per section (in order), then tables with no section. */
export function groupBySection(
  overview: FloorOverview,
  tables: FloorTableOverview[]
): Array<{
  id: string;
  name: string;
  color: string | null;
  tables: FloorTableOverview[];
  seats: number;
  taken: number;
}> {
  const make = (id: string, name: string, color: string | null, list: FloorTableOverview[]) => ({
    id,
    name,
    color,
    tables: list,
    seats: list.reduce((n, t) => n + t.maxOccupancy, 0),
    taken: list.reduce((n, t) => n + t.currentOccupancy, 0),
  });
  const groups = overview.sections
    .map((s) =>
      make(
        s.id,
        s.name,
        s.color,
        tables.filter((t) => t.sectionId === s.id)
      )
    )
    .filter((g) => g.tables.length > 0);
  const loose = tables.filter(
    (t) => !t.sectionId || !overview.sections.some((s) => s.id === t.sectionId)
  );
  if (loose.length > 0) groups.push(make("__none", "No section", null, loose));
  return groups;
}
