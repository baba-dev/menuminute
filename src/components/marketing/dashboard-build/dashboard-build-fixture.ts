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

export type ReplicaTable = {
  id: string;
  number: string;
  /** The demo baseline's table labels (src/modules/demo/baseline.ts). */
  label: string;
  active: number;
  unpaid: number;
  /** Pre-formatted (INR) so server and client render the same text. */
  due?: string;
};

export const REPLICA_TABLES: readonly ReplicaTable[] = [
  { id: "1", number: "1", label: "Table 1", active: 0, unpaid: 0 },
  { id: "2", number: "2", label: "Table 2", active: 1, unpaid: 0 },
  { id: "3", number: "3", label: "Table 3", active: 0, unpaid: 0 },
  { id: "4", number: "4", label: "Table 4", active: 0, unpaid: 1, due: "₹1,240.00" },
  { id: "5", number: "5", label: "Table 5", active: 2, unpaid: 1, due: "₹2,015.00" },
  { id: "6", number: "6", label: "Table 6", active: 0, unpaid: 0 },
  { id: "7", number: "7", label: "Table 7", active: 1, unpaid: 0 },
  { id: "8", number: "8", label: "Table 8", active: 0, unpaid: 0 },
  { id: "9", number: "9", label: "Window booth", active: 1, unpaid: 0 },
  { id: "10", number: "10", label: "Chef's counter", active: 0, unpaid: 1, due: "₹2,380.00" },
  { id: "11", number: "11", label: "Garden terrace", active: 0, unpaid: 0 },
  { id: "12", number: "12", label: "Private dining", active: 3, unpaid: 0 },
];

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

/**
 * The new-order beat. The floor card flips from `before` to `after`; the Dispatch tile and the bell
 * badge each count one more (their "before" numbers are the figures above).
 */
export const REPLICA_NEW_ORDER = {
  tableId: "11",
  before: { status: "No open tickets", counts: "0 active orders · 0 unpaid" },
  after: { status: "Order active", counts: "1 active orders · 0 unpaid" },
} as const;

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
    body: "The Service Dispatch, dining floor and guest requests refresh on a short timer. Order activity is not a physical occupancy sensor.",
    href: "/demo",
    cta: "Try the live demo",
  },
};
