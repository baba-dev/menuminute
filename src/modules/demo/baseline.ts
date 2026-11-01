import demoMenu from "@/data/demo/demo-menu.json";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import { buildDemoOrders, type DemoOrder } from "./history";

import { DEMO_IDS } from "./ids";

export { DEMO_IDS };

export type DemoReservation = {
  id: string;
  tableId: string;
  guestName: string;
  guestPhone: string;
  partySize: number;
  reservationTime: string;
  durationMinutes: number;
  status: "confirmed" | "seated" | "completed" | "cancelled";
  notes: string;
};

export type DemoBaseline = {
  menu: unknown;
  tables: Array<{ id: string; number: string; label: string; capacity: number }>;
  translations: Record<string, unknown>;
  outlet: { name: string; description: string; city: string };
  orders: DemoOrder[];
  floorPlan?: {
    version: 1;
    canvas: { width: number; height: number; gridSnap: number };
    sections: Array<{ id: string; name: string; color: string }>;
    tables: Array<{
      id: string;
      tableNumber: string;
      label: string | null;
      capacity: number;
      shape: "round" | "square" | "rectangle" | "booth" | "bar";
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      section: string;
      assignedStaff: string | null;
    }>;
  };
  reservations?: DemoReservation[];
};

/** Dining-room layout restored on every reset. */
const tables = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `demo-table-${i + 1}`,
    number: String(i + 1),
    label: `Table ${i + 1}`,
    capacity: i < 4 ? 2 : 4,
  })),
  { id: "demo-table-9", number: "9", label: "Window booth", capacity: 6 },
  { id: "demo-table-10", number: "10", label: "Chef's counter", capacity: 4 },
  { id: "demo-table-11", number: "11", label: "Garden terrace", capacity: 6 },
  { id: "demo-table-12", number: "12", label: "Private dining", capacity: 10 },
];

export const demoSections = [
  { id: "sec-main", name: "Main Dining", color: "#f59e0b" },
  { id: "sec-window", name: "Window Room", color: "#06b6d4" },
  { id: "sec-bar", name: "Chef's Counter", color: "#8b5cf6" },
  { id: "sec-terrace", name: "Garden Terrace", color: "#10b981" },
  { id: "sec-private", name: "Private Dining", color: "#ec4899" },
];

export const demoFloorPlan = {
  version: 1 as const,
  canvas: { width: 1300, height: 850, gridSnap: 20 },
  sections: demoSections,
  tables: [
    {
      id: "demo-table-1",
      tableNumber: "1",
      label: "Table 1",
      capacity: 2,
      shape: "round" as const,
      x: 160,
      y: 160,
      width: 90,
      height: 90,
      rotation: 0,
      section: "Main Dining",
      assignedStaff: "Aarav S.",
    },
    {
      id: "demo-table-2",
      tableNumber: "2",
      label: "Table 2",
      capacity: 2,
      shape: "round" as const,
      x: 340,
      y: 160,
      width: 90,
      height: 90,
      rotation: 0,
      section: "Main Dining",
      assignedStaff: "Aarav S.",
    },
    {
      id: "demo-table-3",
      tableNumber: "3",
      label: "Table 3",
      capacity: 4,
      shape: "square" as const,
      x: 160,
      y: 340,
      width: 100,
      height: 100,
      rotation: 0,
      section: "Main Dining",
      assignedStaff: "Aarav S.",
    },
    {
      id: "demo-table-4",
      tableNumber: "4",
      label: "Table 4",
      capacity: 4,
      shape: "square" as const,
      x: 340,
      y: 340,
      width: 100,
      height: 100,
      rotation: 0,
      section: "Main Dining",
      assignedStaff: "Aarav S.",
    },
    {
      id: "demo-table-5",
      tableNumber: "5",
      label: "Table 5",
      capacity: 4,
      shape: "rectangle" as const,
      x: 580,
      y: 160,
      width: 130,
      height: 90,
      rotation: 0,
      section: "Window Room",
      assignedStaff: "Priya K.",
    },
    {
      id: "demo-table-6",
      tableNumber: "6",
      label: "Table 6",
      capacity: 4,
      shape: "rectangle" as const,
      x: 770,
      y: 160,
      width: 130,
      height: 90,
      rotation: 0,
      section: "Window Room",
      assignedStaff: "Priya K.",
    },
    {
      id: "demo-table-7",
      tableNumber: "7",
      label: "Table 7",
      capacity: 4,
      shape: "rectangle" as const,
      x: 580,
      y: 340,
      width: 130,
      height: 90,
      rotation: 0,
      section: "Window Room",
      assignedStaff: "Priya K.",
    },
    {
      id: "demo-table-8",
      tableNumber: "8",
      label: "Table 8",
      capacity: 4,
      shape: "rectangle" as const,
      x: 770,
      y: 340,
      width: 130,
      height: 90,
      rotation: 0,
      section: "Window Room",
      assignedStaff: "Priya K.",
    },
    {
      id: "demo-table-9",
      tableNumber: "9",
      label: "Window booth",
      capacity: 6,
      shape: "booth" as const,
      x: 1000,
      y: 200,
      width: 170,
      height: 110,
      rotation: 0,
      section: "Window Room",
      assignedStaff: "Priya K.",
    },
    {
      id: "demo-table-10",
      tableNumber: "10",
      label: "Chef's counter",
      capacity: 4,
      shape: "bar" as const,
      x: 160,
      y: 580,
      width: 260,
      height: 70,
      rotation: 0,
      section: "Chef's Counter",
      assignedStaff: "Chef Vikram",
    },
    {
      id: "demo-table-11",
      tableNumber: "11",
      label: "Garden terrace",
      capacity: 6,
      shape: "rectangle" as const,
      x: 580,
      y: 570,
      width: 180,
      height: 95,
      rotation: 0,
      section: "Garden Terrace",
      assignedStaff: "Rohan M.",
    },
    {
      id: "demo-table-12",
      tableNumber: "12",
      label: "Private dining",
      capacity: 10,
      shape: "rectangle" as const,
      x: 960,
      y: 560,
      width: 240,
      height: 110,
      rotation: 0,
      section: "Private Dining",
      assignedStaff: "Rohan M.",
    },
  ],
};

/** Validated baseline passed to app_private.reset_demo_outlet. Parsing fails closed in tests/CI. */
export function buildDemoBaseline(now: Date = new Date()): DemoBaseline {
  const menu = menuDocumentSchema.parse(demoMenu);
  const reservations: DemoReservation[] = [
    {
      id: "demo-res-1",
      tableId: "demo-table-9",
      guestName: "Sarah Connor",
      guestPhone: "+91 98765 43210",
      partySize: 4,
      reservationTime: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
      durationMinutes: 90,
      status: "confirmed",
      notes: "Window booth preference; celebrating anniversary.",
    },
    {
      id: "demo-res-2",
      tableId: "demo-table-12",
      guestName: "Dr. Rohan Patel",
      guestPhone: "+91 91234 56789",
      partySize: 8,
      reservationTime: new Date(now.getTime() + 120 * 60 * 1000).toISOString(),
      durationMinutes: 120,
      status: "confirmed",
      notes: "Executive tasting menu preorder with wine pairings.",
    },
    {
      id: "demo-res-3",
      tableId: "demo-table-3",
      guestName: "Ananya Roy",
      guestPhone: "+91 99887 76655",
      partySize: 3,
      reservationTime: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
      durationMinutes: 90,
      status: "seated",
      notes: "High chair requested for toddler.",
    },
  ];

  return {
    orders: buildDemoOrders(
      menu,
      tables.map((t) => t.id),
      now
    ),
    menu,
    tables,
    floorPlan: demoFloorPlan,
    reservations,
    translations: {},
    outlet: {
      name: "Spice Route Kitchen",
      description:
        "A sample restaurant with 236 dishes from every corner of India and beyond. Demo data only; the menu resets every 30 minutes.",
      city: "Demonstration",
    },
  };
}
