import type { DishSafetySnapshot, KitchenWorkView } from "./service";

/** Minutes after which a ticket is labelled overdue (single source for UI and counts). */
export const KITCHEN_OVERDUE_MINUTES = 20;
/** Minutes a queued ticket may wait unstarted before the board draws attention to it. */
export const KITCHEN_WAIT_ALERT_MINUTES = 5;

/** Only rows returned by the authorized kitchen snapshot are included. These are
 * visible-device metrics, not unsupported claims about the entire organization. */
export function kitchenPulse(work: readonly KitchenWorkView[]) {
  const live = work.filter((item) => item.status !== "cancelled");
  return {
    queued: live.filter((item) => item.status === "queued").length,
    preparing: live.filter((item) => item.status === "preparing").length,
    completed: live.filter((item) => item.status === "complete").length,
    activeOrders: new Set(live.map((item) => item.orderId)).size,
  };
}
export function stationGroups(work: readonly KitchenWorkView[], stationId: string | undefined) {
  const relevant = stationId ? work.filter((item) => item.stationId === stationId) : [...work];
  const byAge = (a: KitchenWorkView, b: KitchenWorkView) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.orderNumber - b.orderNumber ||
    a.id.localeCompare(b.id);
  return {
    queued: relevant.filter((item) => item.status === "queued").sort(byAge),
    preparing: relevant.filter((item) => item.status === "preparing").sort(byAge),
    complete: relevant.filter((item) => item.status === "complete").sort(byAge),
  };
}
export function outstandingDishes(work: readonly KitchenWorkView[]) {
  const totals = new Map<string, number>();
  for (const item of work) {
    if (item.status !== "queued" && item.status !== "preparing") continue;
    totals.set(item.dishName, (totals.get(item.dishName) ?? 0) + item.quantity);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Counters are based exclusively on the caller's permission-filtered snapshot.
 * No station or tenant content is fetched from a broader source here. */
export function stationOverview(
  stations: readonly { id: string; name: string }[],
  work: readonly KitchenWorkView[],
  now: number | null
) {
  return stations.map((station) => {
    const current = work.filter((item) => item.stationId === station.id);
    const unfinished = current.filter(
      (item) => item.status === "queued" || item.status === "preparing"
    );
    const oldest = unfinished.reduce<number | null>((value, item) => {
      const timestamp = Date.parse(item.createdAt);
      return Number.isFinite(timestamp)
        ? value === null
          ? timestamp
          : Math.min(value, timestamp)
        : value;
    }, null);
    return {
      ...station,
      queued: current.filter((item) => item.status === "queued").length,
      preparing: current.filter((item) => item.status === "preparing").length,
      completed: current.filter((item) => item.status === "complete").length,
      oldestMinutes:
        now !== null && oldest !== null ? Math.max(0, Math.floor((now - oldest) / 60000)) : null,
    };
  });
}

const ALLERGEN_LABELS: Record<string, string> = {
  dairy: "Dairy",
  gluten: "Gluten",
  nuts: "Tree nuts",
  peanuts: "Peanuts",
  eggs: "Egg",
  soy: "Soy",
  fish: "Fish",
  shellfish: "Shellfish",
  sesame: "Sesame",
  mustard: "Mustard",
  sulfites: "Sulphites",
};
const DIETARY_LABELS: Record<string, string> = {
  vegetarian: "Veg",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
};
const SOURCE_LABELS: Record<string, string> = {
  staff_pos: "POS",
  guest_menu: "QR menu",
  online: "Online",
};
/** Where the order came from; unknown sources show no badge. */
export function intakeSourceLabel(source: string | undefined): string | null {
  return source ? (SOURCE_LABELS[source] ?? null) : null;
}
/**
 * Presents ONLY what the restaurant declared. A dish with no declared allergens
 * yields no allergen chips (never an "allergen free" claim). Unknown allergen
 * codes are ignored rather than shown unvetted.
 */
export function describeDishSafety(safety: DishSafetySnapshot | null | undefined) {
  const allergens = [...new Set(safety?.allergens ?? [])]
    .filter((code) => code in ALLERGEN_LABELS)
    .map((code) => ALLERGEN_LABELS[code]!);
  const dietary = [...new Set(safety?.dietary ?? [])]
    .filter((code) => code in DIETARY_LABELS)
    .map((code) => DIETARY_LABELS[code]!);
  const crossContact = safety?.crossContact?.trim() || null;
  return {
    allergens,
    dietary,
    crossContact,
    /** Declared by the restaurant but not marked verified. */
    unverified: allergens.length > 0 && safety?.verified !== true,
    hasAny: allergens.length > 0 || dietary.length > 0 || crossContact !== null,
  };
}
/** Whether the cook needs to read this ticket closely (modifiers, notes or allergens). */
export function needsAttention(work: {
  selectedOptions: readonly unknown[];
  variantName: string | null;
  notes: string | null;
  orderNotes: string | null;
  dishSafety?: DishSafetySnapshot | null;
}) {
  const safety = describeDishSafety(work.dishSafety);
  return (
    work.selectedOptions.length > 0 ||
    Boolean(work.notes?.trim()) ||
    Boolean(work.orderNotes?.trim()) ||
    safety.allergens.length > 0 ||
    safety.crossContact !== null
  );
}
