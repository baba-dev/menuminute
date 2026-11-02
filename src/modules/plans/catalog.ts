/**
 * Plan catalog and resource caps (slice 1 of docs/plans-and-limits.md).
 *
 * Pure data and functions: no I/O, no UI. Enforcement in services lands in later
 * slices. Numbers are reviewed constants, like the billing catalog; changing one
 * is a code change, never an admin or client input.
 *
 * A `null` cap means "no platform cap; governed by contract or override".
 */
export type PlanKey = "free" | "ordering" | "kitchen_pro" | "dedicated";

export type LimitResource =
  | "outlets"
  | "dishes"
  | "qrCodes"
  | "tables"
  | "chairs"
  | "staffSeats"
  | "aiCreditsPerMonth"
  | "mediaBytes"
  | "ordersPerMonth"
  | "kitchenDevices"
  | "customDomains";

export type PlanLimits = Readonly<Record<LimitResource, number | null>>;

const MB = 1024 * 1024;

export const PLAN_ORDER: readonly PlanKey[] = ["free", "ordering", "kitchen_pro", "dedicated"];

export const PLAN_LIMITS: Readonly<Record<PlanKey, PlanLimits>> = {
  free: {
    outlets: 1,
    dishes: 20,
    qrCodes: 2,
    // Dining floor (owner-approved 2026-11-02): active numbered floor tables and active chairs.
    tables: 2,
    chairs: 6,
    staffSeats: 2,
    aiCreditsPerMonth: 10,
    mediaBytes: 100 * MB,
    // Owner-approved 2026-11-02: Free accepts guest orders, capped per month.
    ordersPerMonth: 100,
    kitchenDevices: 0,
    customDomains: 0,
  },
  ordering: {
    outlets: 1,
    dishes: 200,
    qrCodes: 25,
    tables: 10,
    chairs: 30,
    staffSeats: 5,
    aiCreditsPerMonth: 150,
    mediaBytes: 300 * MB,
    ordersPerMonth: null,
    kitchenDevices: 0,
    customDomains: 0,
  },
  kitchen_pro: {
    outlets: 10,
    dishes: 2000,
    qrCodes: 200,
    tables: 20,
    chairs: 60,
    staffSeats: 25,
    aiCreditsPerMonth: 1000,
    mediaBytes: 500 * MB,
    ordersPerMonth: null,
    kitchenDevices: 10,
    customDomains: 10,
  },
  // Dedicated is sold by contract: caps come from per-organization overrides.
  dedicated: {
    outlets: null,
    dishes: null,
    qrCodes: null,
    tables: null,
    chairs: null,
    staffSeats: null,
    aiCreditsPerMonth: null,
    mediaBytes: null,
    ordersPerMonth: null,
    kitchenDevices: null,
    customDomains: null,
  },
};

export const PLAN_LABELS: Readonly<Record<PlanKey, string>> = {
  free: "Free",
  ordering: "Ordering",
  kitchen_pro: "Kitchen Pro",
  dedicated: "Dedicated",
};

export const RESOURCE_LABELS: Readonly<Record<LimitResource, string>> = {
  outlets: "outlets",
  dishes: "dishes",
  qrCodes: "QR codes",
  tables: "tables",
  chairs: "chairs",
  staffSeats: "staff seats",
  aiCreditsPerMonth: "AI credits per month",
  mediaBytes: "bytes of media",
  ordersPerMonth: "orders per month",
  kitchenDevices: "kitchen devices",
  customDomains: "custom domains",
};
