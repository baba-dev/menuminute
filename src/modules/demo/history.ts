import type { MenuDocument } from "@/modules/menu-product/contracts";

/** One seeded order, exactly as consumed by app_private.seed_demo_orders. */
export type DemoOrder = {
  id: string;
  number: number;
  tableId: string | null;
  mode: "dine_in" | "pickup";
  status:
    | "served"
    | "collected"
    | "cancelled"
    | "rejected"
    | "pending"
    | "accepted"
    | "preparing"
    | "ready";
  paymentStatus: "paid" | "unpaid";
  minutesAgo: number;
  customerName: string;
  intake: "guest_menu";
  rejection?: string;
  live?: boolean;
  liveSteps?: Array<"accepted" | "preparing" | "ready">;
  events: Array<{ from: string | null; to: string; minutesAgo: number; note?: string }>;
  items: Array<{
    dishId: string;
    dishName: string;
    variantId: string | null;
    variantName: string | null;
    selectedOptions: Array<{
      groupId: string;
      groupName: string;
      optionId: string;
      optionName: string;
      priceMinor: number;
    }>;
    unitPriceMinor: number;
    quantity: number;
  }>;
};

const IST_OFFSET_MS = 330 * 60 * 1000;
const HISTORY_DAYS = 30;
const names = [
  "Aarav",
  "Diya",
  "Vihaan",
  "Ananya",
  "Arjun",
  "Isha",
  "Kabir",
  "Meera",
  "Rohan",
  "Saanvi",
  "Aditya",
  "Priya",
  "Karthik",
  "Neha",
  "Rahul",
  "Sneha",
  "Vikram",
  "Pooja",
  "Imran",
  "Fatima",
  "Sanjay",
  "Lakshmi",
  "Dev",
  "Tara",
  "Manish",
  "Riya",
  "Nikhil",
  "Kavya",
  "Zoya",
  "Harsh",
];

/** Small deterministic PRNG (mulberry32) so the same `now` always yields the same history. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dish = MenuDocument["categories"][number]["items"][number];

function buildItems(rand: () => number, dishes: Dish[], weights: number[], tableCount: number) {
  void tableCount;
  const lines = 1 + Math.floor(rand() * 4) + (rand() < 0.2 ? 1 : 0);
  const chosen = new Set<number>();
  const items: DemoOrder["items"] = [];
  const total = weights.reduce((s, w) => s + w, 0);
  let guard = 0;
  while (items.length < lines && guard++ < 40) {
    let r = rand() * total;
    let index = 0;
    for (; index < weights.length; index++) {
      r -= weights[index]!;
      if (r <= 0) break;
    }
    index = Math.min(index, dishes.length - 1);
    if (chosen.has(index)) continue;
    chosen.add(index);
    const dish = dishes[index]!;
    const variant = dish.variants.length
      ? dish.variants[Math.floor(rand() * dish.variants.length)]!
      : null;
    const selectedOptions: DemoOrder["items"][number]["selectedOptions"] = [];
    for (const group of dish.addOnGroups) {
      const wanted = group.min > 0 ? group.min : rand() < 0.3 ? 1 : 0;
      for (let k = 0; k < Math.min(wanted, group.max, group.options.length); k++) {
        const option =
          group.options[(Math.floor(rand() * group.options.length) + k) % group.options.length]!;
        if (selectedOptions.some((s) => s.groupId === group.id && s.optionId === option.id))
          continue;
        selectedOptions.push({
          groupId: group.id,
          groupName: group.name,
          optionId: option.id,
          optionName: option.name,
          priceMinor: option.priceMinor,
        });
      }
    }
    const base = variant ? variant.priceMinor : dish.priceMinor;
    items.push({
      dishId: dish.id,
      dishName: dish.name,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      selectedOptions,
      unitPriceMinor: base + selectedOptions.reduce((s, o) => s + o.priceMinor, 0),
      quantity: 1 + (rand() < 0.25 ? 1 : 0) + (rand() < 0.05 ? 1 : 0),
    });
  }
  return items;
}

/**
 * About 30 days of realistic service history plus a handful of LIVE orders (pending, accepted,
 * preparing, ready) so Orders, Kitchen and Reports look busy immediately after every reset.
 * Pure and deterministic for a given `now`; no network, no clock reads.
 */
export function buildDemoOrders(menu: MenuDocument, tableIds: string[], now: Date): DemoOrder[] {
  const dishes = menu.categories.flatMap((c) => c.items);
  const featured = new Set(menu.presentation?.featuredDishIds ?? []);
  // Popular, mid-priced, featured dishes are ordered more often than rare regional specials.
  const weights = dishes.map((d, i) => {
    const mid = d.priceMinor >= 15000 && d.priceMinor <= 40000 ? 1.6 : 1;
    return (featured.has(d.id) ? 6 : 1) * mid * (0.6 + ((i * 37) % 10) / 10);
  });
  const orders: DemoOrder[] = [];
  const nowMs = now.getTime();
  const todayIst = Math.floor((nowMs + IST_OFFSET_MS) / 86400000);
  const daily = new Map<number, number>();
  let serial = 0;

  for (let d = HISTORY_DAYS; d >= 0; d--) {
    const dayIndex = todayIst - d;
    const weekday = new Date(dayIndex * 86400000).getUTCDay();
    const rand = rng(dayIndex * 7919 + 13);
    const growth = 0.75 + 0.5 * ((HISTORY_DAYS - d) / HISTORY_DAYS);
    const count = Math.round((weekday === 0 || weekday === 6 ? 19 : 12) * growth + rand() * 4);
    for (let k = 0; k < count; k++) {
      // Lunch (12:30-14:30) and dinner (19:00-22:00) peaks, with a thin shoulder in between.
      const peak = rand();
      const minuteOfDay =
        peak < 0.42
          ? 12 * 60 + 30 + Math.floor(rand() * 120)
          : peak < 0.9
            ? 19 * 60 + Math.floor(rand() * 180)
            : 15 * 60 + Math.floor(rand() * 240);
      const createdMs = dayIndex * 86400000 - IST_OFFSET_MS + minuteOfDay * 60000;
      const minutesAgo = Math.floor((nowMs - createdMs) / 60000);
      if (minutesAgo < 90) continue; // the last 90 minutes are reserved for live orders
      const mode = rand() < 0.62 ? "dine_in" : "pickup";
      const outcome = rand();
      const status =
        outcome < 0.93
          ? mode === "dine_in"
            ? "served"
            : "collected"
          : outcome < 0.97
            ? "cancelled"
            : "rejected";
      const n = (daily.get(dayIndex) ?? 0) + 1;
      daily.set(dayIndex, n);
      const events: DemoOrder["events"] = [
        { from: null, to: "pending", minutesAgo, note: "Order placed" },
      ];
      if (status === "rejected") {
        events.push({
          from: "pending",
          to: "rejected",
          minutesAgo: minutesAgo - 2,
          note: "Kitchen is closing",
        });
      } else {
        events.push({ from: "pending", to: "accepted", minutesAgo: minutesAgo - 2 });
        events.push({ from: "accepted", to: "preparing", minutesAgo: minutesAgo - 8 });
        if (status === "cancelled") {
          events.push({
            from: "preparing",
            to: "cancelled",
            minutesAgo: minutesAgo - 14,
            note: "Guest left",
          });
        } else {
          events.push({ from: "preparing", to: "ready", minutesAgo: minutesAgo - 24 });
          events.push({ from: "ready", to: status, minutesAgo: minutesAgo - 32 });
        }
      }
      orders.push({
        id: `demo-ord-${++serial}`,
        number: n,
        tableId: mode === "dine_in" ? tableIds[Math.floor(rand() * tableIds.length)]! : null,
        mode,
        status,
        paymentStatus: status === "served" || status === "collected" ? "paid" : "unpaid",
        minutesAgo,
        customerName: names[Math.floor(rand() * names.length)]!,
        intake: "guest_menu",
        ...(status === "rejected" ? { rejection: "Kitchen is closing" } : {}),
        ...(status === "cancelled" ? { rejection: "Guest left" } : {}),
        events,
        items: buildItems(rand, dishes, weights, tableIds.length),
      });
    }
  }

  // Live board: 3 pending, 3 accepted, 2 preparing, 1 ready.
  const liveRand = rng(todayIst * 104729 + 7);
  const live: Array<[number, DemoOrder["liveSteps"]]> = [
    [2, []],
    [4, []],
    [7, []],
    [12, ["accepted"]],
    [15, ["accepted"]],
    [19, ["accepted"]],
    [26, ["accepted", "preparing"]],
    [31, ["accepted", "preparing"]],
    [42, ["accepted", "preparing", "ready"]],
  ];
  const todayCount = daily.get(todayIst) ?? 0;
  live.forEach(([minutesAgo, liveSteps], i) => {
    const mode = i % 3 === 2 ? "pickup" : "dine_in";
    const status = liveSteps!.length ? liveSteps![liveSteps!.length - 1]! : "pending";
    orders.push({
      id: `demo-ord-${++serial}`,
      number: todayCount + i + 1,
      tableId: mode === "dine_in" ? tableIds[i % tableIds.length]! : null,
      mode,
      status,
      paymentStatus: "unpaid",
      minutesAgo,
      customerName: names[Math.floor(liveRand() * names.length)]!,
      intake: "guest_menu",
      live: true,
      liveSteps,
      events: [],
      items: buildItems(liveRand, dishes, weights, tableIds.length),
    });
  });
  return orders;
}
