import {
  BookOpen,
  CheckCircle2,
  ChefHat,
  FilePenLine,
  Globe2,
  Layers3,
  Plus,
  QrCode,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { getServicePeriodText } from "@/lib/service-period";
import type { TodayPulse } from "@/modules/dashboard/today-pulse";
import type {
  FloorChair,
  FloorOverview,
  FloorTableOverview,
  TableShape,
} from "@/modules/hospitality/floor-contracts";
import type { TableDue } from "@/modules/hospitality/floor-glance";
import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import type { PieceId } from "./dashboard-build-timeline";

/**
 * Sample data for the marketing replica. Modelled on the public demo outlet
 * (src/modules/demo/baseline.ts: "Spice Route Kitchen", 236 dishes in 14 categories).
 * It is sample data, never a customer's numbers, and must not be presented as verified.
 */
export const REPLICA_OUTLET_NAME = "Spice Route Kitchen";

/** Every optional workspace area enabled, so the replica shows the full navigation. */
export const REPLICA_CAPABILITIES: DashboardNavigation = {
  ordering: true,
  kitchen: true,
  ordersRead: true,
  kitchenRead: true,
  kitchenSetup: false,
  kitchenOperational: true,
  kitchenDraining: false,
};

export type ReplicaKpi = {
  id: Extract<PieceId, `kpi-${number}`>;
  /** Labels and details are the real dashboard's strings (dashboard/page.tsx). */
  label: string;
  detail: string;
  Icon: LucideIcon;
  /** A number counts up with scroll; text is shown as-is. */
  value: number | string;
  positive?: boolean;
};

export const REPLICA_KPIS: readonly ReplicaKpi[] = [
  {
    id: "kpi-1",
    label: "Published menus",
    detail: "Guest-visible releases",
    Icon: BookOpen,
    value: 1,
  },
  {
    id: "kpi-2",
    label: "Categories",
    detail: "In your live menu",
    Icon: Layers3,
    value: 14,
  },
  {
    id: "kpi-3",
    label: "Dishes",
    detail: "Published and visible",
    Icon: ChefHat,
    value: 236,
  },
  {
    id: "kpi-4",
    label: "Active QR codes",
    detail: "Permanent menu links",
    Icon: QrCode,
    value: 1,
  },
  {
    id: "kpi-5",
    label: "Menus to publish",
    detail: "With unpublished edits",
    Icon: FilePenLine,
    value: 0,
  },
  {
    id: "kpi-6",
    label: "Public menu status",
    detail: "Available to guests",
    Icon: Globe2,
    value: "Live",
    positive: true,
  },
];

/** Sample till figure for the top-bar chip. */
export const REPLICA_TILL_LABEL = "Till open · ₹8,420";
export const REPLICA_BELL_COUNT = 3;

/** Midday copy from the real `getServicePeriodText`, so the wording cannot drift from the product. */
export const REPLICA_SERVICE_PERIOD = getServicePeriodText(12);

export const REPLICA_DISH_COUNT = 236;

/** The real dashboard's "published menu" priorities (dashboard/page.tsx). */
export const REPLICA_PRIORITIES: readonly {
  title: string;
  detail: string;
  action: string;
  Icon: LucideIcon;
}[] = [
  {
    title: "Add a new dish",
    detail: "Grow your menu with something special.",
    action: "Add dish",
    Icon: Plus,
  },
  {
    title: "Refine your menu",
    detail: "Update descriptions, prices or availability.",
    action: "Edit menu",
    Icon: UtensilsCrossed,
  },
  {
    title: "Share your QR",
    detail: "Download or print a permanent menu link.",
    action: "View QR",
    Icon: QrCode,
  },
];

export type ReplicaHealthRow = {
  Icon: LucideIcon;
  title: string;
  detail: string;
  badge: string;
};

/** Real labels for an outlet with a published menu and one active QR code. */
export const REPLICA_HEALTH_ROWS: readonly ReplicaHealthRow[] = [
  {
    Icon: BookOpen,
    title: "Menu publish status",
    detail: "A committed public release is available",
    badge: "Live",
  },
  {
    Icon: QrCode,
    title: "QR codes",
    detail: "1 active permanent link",
    badge: "Active",
  },
  {
    Icon: Globe2,
    title: "Menu visibility",
    detail: "Accessible through your active menu link",
    badge: "Public",
  },
];

/** Setup completion: sample figures for a fully launched outlet. */
export const REPLICA_SETUP = { completed: 4, total: 4, percent: 100, Icon: CheckCircle2 } as const;

/**
 * Service Dispatch counters. The labels are the real ones; the numbers are sample figures shaped
 * like the demo outlet's live board (a few waiting, a few in preparation, one ready).
 */
export const REPLICA_DISPATCH = {
  snapshot: "Snapshot updated at 12:04 PM (Asia/Kolkata)",
  counters: [
    { label: "Awaiting acceptance", value: 3 },
    { label: "In preparation", value: 2 },
    { label: "Ready for handoff", value: 1 },
    { label: "Completed today", value: 18 },
  ],
} as const;

/**
 * The demo outlet's 12 tables (labels and capacities from `src/modules/demo/baseline.ts`) as the
 * product's own `FloorOverview`, so the shared floor view renders them exactly as the live
 * dashboard would. Shapes, sections, seated guests and order activity are sample data.
 */
type TableSpec = {
  n: number;
  name: string;
  shape: TableShape;
  section: 0 | 1 | 2;
  chairs: number;
  taken: number;
  active: number;
  unpaid: number;
  duePaise?: number;
};

const FLOOR_SECTIONS: FloorOverview["sections"] = [
  { id: "sec-main", name: "Main hall", color: "#e0703a", sortOrder: 0 },
  { id: "sec-window", name: "Window & counter", color: "#4a8f6b", sortOrder: 1 },
  { id: "sec-garden", name: "Garden & private", color: "#8a6bbf", sortOrder: 2 },
];

const TABLE_SPECS: readonly TableSpec[] = [
  { n: 1, name: "Table 1", shape: "round", section: 0, chairs: 2, taken: 0, active: 0, unpaid: 0 },
  { n: 2, name: "Table 2", shape: "round", section: 0, chairs: 2, taken: 2, active: 1, unpaid: 0 },
  { n: 3, name: "Table 3", shape: "round", section: 0, chairs: 2, taken: 0, active: 0, unpaid: 0 },
  {
    n: 4,
    name: "Table 4",
    shape: "round",
    section: 0,
    chairs: 2,
    taken: 1,
    active: 0,
    unpaid: 1,
    duePaise: 124000,
  },
  {
    n: 5,
    name: "Table 5",
    shape: "square",
    section: 0,
    chairs: 4,
    taken: 3,
    active: 1,
    unpaid: 1,
    duePaise: 201500,
  },
  { n: 6, name: "Table 6", shape: "square", section: 0, chairs: 4, taken: 0, active: 0, unpaid: 0 },
  { n: 7, name: "Table 7", shape: "square", section: 0, chairs: 4, taken: 4, active: 1, unpaid: 0 },
  { n: 8, name: "Table 8", shape: "square", section: 0, chairs: 4, taken: 0, active: 0, unpaid: 0 },
  {
    n: 9,
    name: "Window booth",
    shape: "booth",
    section: 1,
    chairs: 6,
    taken: 4,
    active: 1,
    unpaid: 0,
  },
  {
    n: 10,
    name: "Chef's counter",
    shape: "rectangle",
    section: 1,
    chairs: 4,
    taken: 2,
    active: 0,
    unpaid: 1,
    duePaise: 238000,
  },
  {
    n: 11,
    name: "Garden terrace",
    shape: "rectangle",
    section: 2,
    chairs: 6,
    taken: 0,
    active: 0,
    unpaid: 0,
  },
  {
    n: 12,
    name: "Private dining",
    shape: "rectangle",
    section: 2,
    chairs: 10,
    taken: 6,
    active: 2,
    unpaid: 0,
  },
];

/** The new order lands on this (seated-nobody) table. Order activity never changes who is seated. */
export const REPLICA_NEW_ORDER_TABLE = "11";

/** Order activity is context only, so the new order changes `activeOrders` and nothing else. */
export function buildReplicaFloor(newOrder: boolean): {
  overview: FloorOverview;
  dueByTable: Record<string, TableDue>;
} {
  const tables: FloorTableOverview[] = TABLE_SPECS.map((spec) => {
    const id = String(spec.n);
    const chairs: FloorChair[] = Array.from({ length: spec.chairs }, (_, i) => ({
      id: `${id}-c${i + 1}`,
      tableId: id,
      label: null,
      kind: "standard",
      occupied: i < spec.taken,
      occupiedAt: null,
      version: 0,
    }));
    return {
      id,
      displayNumber: spec.n,
      name: spec.name,
      shape: spec.shape,
      sectionId: FLOOR_SECTIONS[spec.section]!.id,
      chairs,
      maxOccupancy: spec.chairs,
      currentOccupancy: spec.taken,
      state: spec.taken === 0 ? "empty" : spec.taken >= spec.chairs ? "full" : "partial",
      activeOrders: spec.active + (newOrder && id === REPLICA_NEW_ORDER_TABLE ? 1 : 0),
      unpaidOrders: spec.unpaid,
      nextReservation: null,
      qrCode: null,
      stale: false,
    };
  });
  const dueByTable: Record<string, TableDue> = {};
  for (const spec of TABLE_SPECS) {
    if (!spec.duePaise) continue;
    dueByTable[String(spec.n)] = {
      dueMinor: String(spec.duePaise),
      latestOrderId: `order-${spec.n}`,
      unpaidOrders: spec.unpaid,
    };
  }
  return {
    overview: {
      sections: FLOOR_SECTIONS,
      tables,
      unassignedChairs: [],
      totals: {
        tables: tables.length,
        chairs: tables.reduce((n, t) => n + t.maxOccupancy, 0),
        maxOccupancy: tables.reduce((n, t) => n + t.maxOccupancy, 0),
        currentOccupancy: tables.reduce((n, t) => n + t.currentOccupancy, 0),
        sections: FLOOR_SECTIONS.length,
        tablesOccupied: tables.filter((t) => t.currentOccupancy > 0).length,
      },
      nextReservation: null,
    },
    dueByTable,
  };
}

/** Deterministic INR formatting, so server and client render identical text. */
export const REPLICA_LOCALE = "en-IN";
const rupees = new Intl.NumberFormat(REPLICA_LOCALE, { style: "currency", currency: "INR" });
export const formatReplicaMinor = (minor: string) => rupees.format(Number(minor) / 100);

/**
 * Today's pulse sample, shaped like the real read model (`TodayPulse`). Top sellers are real demo
 * dishes and prices; the quantities, sales and guest counts are sample figures. Open orders match
 * the Service Dispatch tiles (3 awaiting + 2 in preparation + 1 ready), and the new order adds one.
 */
export function buildReplicaPulse(newOrder: boolean): TodayPulse {
  const newOrderMinor = 41200;
  const hourlyMinor = Array.from({ length: 24 }, () => 0);
  hourlyMinor[9] = 186400;
  hourlyMinor[10] = 412000;
  hourlyMinor[11] = 628000;
  hourlyMinor[12] = 637600 + (newOrder ? newOrderMinor : 0);
  const grossMinor = hourlyMinor.reduce((n, v) => n + v, 0);
  const orders = 24 + (newOrder ? 1 : 0);
  return {
    currency: "INR",
    hour: 12,
    sales: {
      grossMinor,
      orders,
      aovMinor: Math.round(grossMinor / orders),
      vsYesterdayPct: 12,
      hourlyMinor,
    },
    topSellers: [
      {
        dishId: "MM-CORE-butter-chicken",
        name: "Butter Chicken",
        quantity: 9,
        revenueMinor: 359100,
      },
      { dishId: "MM-CORE-biryani", name: "Biryani", quantity: 7, revenueMinor: 195300 },
      { dishId: "MM-IN-045", name: "Chettinad Chicken", quantity: 6, revenueMinor: 245400 },
      { dishId: "MM-IN-013", name: "Amritsari Fish", quantity: 5, revenueMinor: 179500 },
    ],
    wait: { openOrders: 6 + (newOrder ? 1 : 0), averageMinutes: 11, oldestMinutes: 18 },
    guests: { newGuests: 5, returningGuests: 7, ordersWithoutContact: 3 },
  };
}

/** Sample guest requests for "At your service" (shape of `GuestServiceRequest`). */
export const REPLICA_REQUESTS: readonly {
  id: string;
  title: string;
  signal: string;
  status: "requested" | "acknowledged";
  time: string;
}[] = [
  {
    id: "r1",
    title: "Table 5 · Order #1042",
    signal: "Call server",
    status: "requested",
    time: "12:01 PM",
  },
  {
    id: "r2",
    title: "Table 12 · Order #1038",
    signal: "Bill request",
    status: "acknowledged",
    time: "11:58 AM",
  },
];

export type ChapterCaption = { title: string; body: string; href: string; cta: string };

/**
 * One caption and one link per chapter. The statements describe what the replica shows and what the
 * product code does (refresh intervals, plan-dependent areas); none promises availability.
 * Every `href` is an existing public page (checked by tests/dashboard-build-timeline.test.ts).
 */
export const CHAPTER_CAPTIONS: Record<string, ChapterCaption> = {
  navigate: {
    title: "One workspace for the whole outlet",
    body: "Run service, menu, insights and admin sit in one sidebar. Ordering and Kitchen areas appear when your plan includes them.",
    href: "/pricing",
    cta: "See plans",
  },
  overview: {
    title: "Your outlet at a glance",
    body: "A welcome for the time of day and six counts for your published menus, categories, dishes and QR codes.",
    href: "/help/owner",
    cta: "Read the owner guide",
  },
  priorities: {
    title: "Your next move, every day",
    body: "A few quick actions to keep the menu fresh, accurate and guest-ready, with one place to publish changes.",
    href: "/help/owner",
    cta: "How publishing works",
  },
  health: {
    title: "Publishing status you can trust",
    body: "Menu status, QR links, visibility and setup progress. Each state is an icon and a word, never colour alone.",
    href: "/docs",
    cta: "Browse the documentation",
  },
  "live-service": {
    title: "Live service, in one view",
    body: "The Service Dispatch, dining floor, guest requests and today’s pulse refresh on a short timer. Order activity is not a physical occupancy sensor.",
    href: "/demo",
    cta: "Try the live demo",
  },
};
