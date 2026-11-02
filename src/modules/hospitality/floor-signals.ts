import type {
  FloorSignalSettings,
  JourneyStep,
  JourneyStepKey,
  TableJourney,
} from "./floor-contracts";

/** Pure view-model: turns ledger events and the latest order into guest-journey indicators. */

export const DEFAULT_SIGNAL_SETTINGS: FloorSignalSettings = {
  enabled: false,
  qrScanPings: true,
  guestWaterButton: true,
  showKitchen: true,
  showPosBill: true,
};

export type SignalEventInput = {
  kind: string;
  occurredAt: string;
};

export type JourneyOrderInput = {
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  dishCount: number;
};

const DEAD = new Set(["rejected", "cancelled", "expired"]);
const DELIVERED = new Set(["served", "collected", "delivered"]);

function latest(events: SignalEventInput[], ...kinds: string[]): SignalEventInput | null {
  let best: SignalEventInput | null = null;
  for (const e of events) {
    if (!kinds.includes(e.kind)) continue;
    if (!best || new Date(e.occurredAt) > new Date(best.occurredAt)) best = e;
  }
  return best;
}

const dishes = (n: number) => (n > 0 ? `${n} dish${n === 1 ? "" : "es"}` : null);

export function buildJourney(input: {
  settings: FloorSignalSettings;
  events: SignalEventInput[];
  order: JourneyOrderInput | null;
}): TableJourney | null {
  const { settings, events } = input;
  if (!settings.enabled) return null;
  const order = input.order && !DEAD.has(input.order.status) ? input.order : null;
  const steps: JourneyStep[] = [];
  const add = (
    key: JourneyStepKey,
    state: JourneyStep["state"],
    at: string | null,
    detail: string | null = null
  ) => steps.push({ key, state, at, detail });

  if (settings.qrScanPings) {
    const scan = latest(events, "qr_scanned");
    add("qr", scan ? "done" : "idle", scan?.occurredAt ?? null);
  }

  add(
    "order",
    order ? "done" : "idle",
    order?.createdAt ?? null,
    order ? dishes(order.dishCount) : null
  );

  const status = order?.status ?? "";
  if (settings.showKitchen) {
    add(
      "cooking",
      status === "preparing"
        ? "active"
        : status === "ready" || DELIVERED.has(status)
          ? "done"
          : "idle",
      status === "preparing" || status === "ready" || DELIVERED.has(status)
        ? (order?.updatedAt ?? null)
        : null
    );
    add(
      "ready",
      status === "ready" ? "active" : DELIVERED.has(status) ? "done" : "idle",
      status === "ready" || DELIVERED.has(status) ? (order?.updatedAt ?? null) : null
    );
  }
  add(
    "delivered",
    DELIVERED.has(status) ? "done" : "idle",
    DELIVERED.has(status) ? (order?.updatedAt ?? null) : null
  );

  let needsStaff = false;
  if (settings.showPosBill) {
    const requested = latest(events, "bill_requested");
    const presented = latest(events, "bill_presented");
    const paid = order?.paymentStatus === "paid" || latest(events, "paid") !== null;
    const waiting =
      requested !== null &&
      !paid &&
      (!presented || new Date(requested.occurredAt) > new Date(presented.occurredAt));
    if (waiting) needsStaff = true;
    add(
      "bill",
      waiting ? "active" : presented || paid ? "done" : "idle",
      waiting ? requested.occurredAt : (presented?.occurredAt ?? null),
      waiting ? "Guest asked" : null
    );
    add("paid", paid ? "done" : "idle", paid ? (order?.updatedAt ?? null) : null);
  }

  if (settings.guestWaterButton) {
    const water = latest(events, "water_requested", "water_acknowledged", "water_served");
    const state: JourneyStep["state"] = !water
      ? "idle"
      : water.kind === "water_served"
        ? "done"
        : "active";
    if (state === "active") needsStaff = true;
    add(
      "water",
      state,
      water?.occurredAt ?? null,
      water?.kind === "water_requested"
        ? "Requested"
        : water?.kind === "water_acknowledged"
          ? "On the way"
          : water
            ? "Served"
            : null
    );
  }
  return { steps, needsStaff };
}
