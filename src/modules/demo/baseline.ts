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
