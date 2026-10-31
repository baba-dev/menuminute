import { z } from "zod";

export const tableShapeSchema = z.enum(["round", "square", "rectangle", "booth", "bar"]);
export type TableShape = z.infer<typeof tableShapeSchema>;

export const visualTableSchema = z.object({
  id: z.string().min(1).max(128),
  tableNumber: z.string().trim().min(1).max(32),
  label: z.string().trim().max(80).nullable().default(null),
  capacity: z.number().int().min(1).max(30).default(4),
  shape: tableShapeSchema.default("rectangle"),
  x: z.number().int().min(0).max(4000).default(100),
  y: z.number().int().min(0).max(4000).default(100),
  width: z.number().int().min(40).max(800).default(120),
  height: z.number().int().min(40).max(800).default(90),
  rotation: z.number().int().min(0).max(360).default(0),
  section: z.string().trim().min(1).max(64).default("Main Dining"),
  assignedStaff: z.string().trim().max(64).nullable().default(null),
});
export type VisualTable = z.infer<typeof visualTableSchema>;

export const diningSectionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#f59e0b"),
});
export type DiningSection = z.infer<typeof diningSectionSchema>;

export const floorLayoutDocSchema = z.object({
  version: z.literal(1).default(1),
  revision: z.number().int().nonnegative().default(0),
  canvas: z.object({
    width: z.number().int().min(600).max(4000).default(1400),
    height: z.number().int().min(400).max(3000).default(900),
    gridSnap: z.number().int().min(5).max(100).default(20),
  }),
  sections: z.array(diningSectionSchema).max(24).default([]),
  tables: z.array(visualTableSchema).max(200).default([]),
}).superRefine((layout, context) => {
  const ids = new Set<string>();
  const numbers = new Set<string>();
  for (const table of layout.tables) {
    if (ids.has(table.id)) {
      context.addIssue({ code: "custom", path: ["tables"], message: "Duplicate table identifier" });
    }
    ids.add(table.id);
    if (numbers.has(table.tableNumber)) {
      context.addIssue({ code: "custom", path: ["tables"], message: "Duplicate table number" });
    }
    numbers.add(table.tableNumber);
    if (!layout.sections.some((section) => section.name === table.section)) {
      context.addIssue({ code: "custom", path: ["tables"], message: "Unknown table section" });
    }
  }
});
export type FloorLayoutDoc = z.infer<typeof floorLayoutDocSchema>;

export type TableLiveStatus = {
  state: "available" | "active" | "unpaid" | "reserved" | "maintenance";
  activeOrders: number;
  unpaidOrders: number;
  dueMinor: string;
  currency: string;
  latestOrderId: string | null;
  hasServiceRequest?: {
    signal: "water_refill" | "call_server" | "bill_request";
    id: string;
    requestedAt: string;
  };
  upcomingReservation?: {
    id: string;
    guestName: string;
    partySize: number;
    time: string;
    notes?: string | null;
  };
  qrCode?: {
    id: string;
    destinationToken: string;
    label: string;
    isActive: boolean;
  };
};

export type ReservationItem = {
  id: string;
  outletId: string;
  tableId: string | null;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  partySize: number;
  reservationTime: string;
  durationMinutes: number;
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  createdAt: string;
};

export const createReservationInputSchema = z.object({
  tableId: z.string().min(1).max(128).nullable().optional(),
  guestName: z.string().trim().min(1).max(100),
  guestPhone: z.string().trim().max(30).nullable().optional(),
  guestEmail: z.string().trim().email().max(120).nullable().optional(),
  partySize: z.number().int().min(1).max(50),
  reservationTime: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480).default(90),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type CreateReservationInput = z.infer<typeof createReservationInputSchema>;
