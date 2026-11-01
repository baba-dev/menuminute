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
