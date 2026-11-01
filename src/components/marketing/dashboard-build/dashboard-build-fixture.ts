import {
  BookOpen,
  ChefHat,
  FilePenLine,
  Globe2,
  Layers3,
  QrCode,
  type LucideIcon,
} from "lucide-react";
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
