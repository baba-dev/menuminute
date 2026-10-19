import { z } from "zod";
import { ConflictError, ValidationError } from "@/lib/errors";

/**
 * Deterministic Phase 5 kitchen domain reducer. The authoritative service must execute these
 * version checks under a PostgreSQL transaction with current scoped station permissions and
 * persist changes with audit/outbox. The reducer itself never authorizes a browser or writes Redis.
 */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const line = z
  .object({
    id,
    dishName: z.string().min(1).max(100),
    quantity: z.number().int().positive().safe(),
  })
  .strict();
const route = z
  .object({
    lineId: id,
    stationIds: z.array(id).min(1).max(16),
    ruleVersion: z.number().int().positive(),
  })
  .strict();
export const kitchenAssignmentSchema = z
  .object({
    organizationId: id,
    outletId: id,
    orderId: id,
    lines: z.array(line).min(1).max(100),
    routes: z.array(route).min(1).max(100),
  })
  .strict();

export type WorkState = "queued" | "preparing" | "complete" | "cancelled";
export type StationWork = {
  id: string;
  organizationId: string;
  outletId: string;
  orderId: string;
  lineId: string;
  dishName: string;
  quantity: number;
  stationId: string;
  ruleVersion: number;
  state: WorkState;
  version: number;
};
export type ExpoState = {
  orderId: string;
  work: StationWork[];
  released: boolean;
  version: number;
};
export function assignStationWork(raw: unknown): ExpoState {
  const data = kitchenAssignmentSchema.parse(raw);
  const lines = new Map(data.lines.map((l) => [l.id, l]));
  if (lines.size !== data.lines.length) throw new ValidationError("Duplicate order line");
  if (new Set(data.routes.map((r) => r.lineId)).size !== data.routes.length)
    throw new ValidationError("Duplicate line routing");
  if (data.routes.length !== lines.size || data.routes.some((r) => !lines.has(r.lineId)))
    throw new ValidationError("Every order line requires an authorized station route");
  const work: StationWork[] = [];
  for (const r of data.routes) {
    if (new Set(r.stationIds).size !== r.stationIds.length)
      throw new ValidationError("A station cannot receive the same line twice");
    const item = lines.get(r.lineId)!;
    for (const stationId of r.stationIds) {
      work.push({
        id: `${data.orderId}:${r.lineId}:${stationId}:${r.ruleVersion}`,
        organizationId: data.organizationId,
        outletId: data.outletId,
        orderId: data.orderId,
        lineId: item.id,
        dishName: item.dishName,
        quantity: item.quantity,
        stationId,
        ruleVersion: r.ruleVersion,
        state: "queued",
        version: 0,
      });
    }
  }
  return { orderId: data.orderId, work, released: false, version: 0 };
}
export type StationCommand = {
  workId: string;
  expectedVersion: number;
  action: "start" | "complete" | "cancel";
};
export function advanceStationWork(state: ExpoState, command: StationCommand): ExpoState {
  if (state.released) throw new ConflictError("The order has already been released by expeditor");
  const existing = state.work.find((w) => w.id === command.workId);
  if (!existing) throw new ValidationError("Unknown station work");
  if (existing.version !== command.expectedVersion) throw new ConflictError("Station work changed");
  const allowed =
    (command.action === "start" && existing.state === "queued") ||
    (command.action === "complete" && existing.state === "preparing") ||
    (command.action === "cancel" &&
      (existing.state === "queued" || existing.state === "preparing"));
  if (!allowed) throw new ConflictError("Invalid station transition");
  const next: WorkState =
    command.action === "start"
      ? "preparing"
      : command.action === "complete"
        ? "complete"
        : "cancelled";
  return {
    ...state,
    version: state.version + 1,
    work: state.work.map((w) =>
      w.id === existing.id ? { ...w, state: next, version: w.version + 1 } : w
    ),
  };
}
/** Cancelled work cannot silently make a guest order Ready; a separately audited reroute is required. */
export function canExpeditorRelease(state: ExpoState): boolean {
  return (
    !state.released && state.work.length > 0 && state.work.every((w) => w.state === "complete")
  );
}
export function releaseFromExpeditor(state: ExpoState, expectedVersion: number): ExpoState {
  if (state.version !== expectedVersion) throw new ConflictError("Kitchen ticket changed");
  if (!canExpeditorRelease(state))
    throw new ConflictError("Every required station must finish before expeditor release");
  return { ...state, released: true, version: state.version + 1 };
}
/** Item totals are deduplicated across station work IDs, and incomplete work is visible by station. */
export function stationSummary(state: ExpoState, stationId: string) {
  const work = state.work.filter((w) => w.stationId === stationId);
  return {
    queued: work.filter((w) => w.state === "queued").length,
    preparing: work.filter((w) => w.state === "preparing").length,
    complete: work.filter((w) => w.state === "complete").length,
    outstandingQuantity: work
      .filter((w) => w.state !== "complete" && w.state !== "cancelled")
      .reduce((sum, w) => sum + BigInt(w.quantity), 0n)
      .toString(),
  };
}
