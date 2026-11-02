import { z } from "zod";

/** Dining floor v2 contracts: tables, real chairs, sections, derived occupancy and reservations. */

export const tableShapeSchema = z.enum(["round", "square", "rectangle", "booth"]);
export type TableShape = z.infer<typeof tableShapeSchema>;

export const chairKindSchema = z.enum(["standard", "high_chair", "bar_stool", "accessible"]);
export type ChairKind = z.infer<typeof chairKindSchema>;

export const MAX_CHAIRS_PER_TABLE = 30;
export const MAX_TABLES_PER_OUTLET = 200;

const idSchema = z.string().trim().min(1).max(128);

export const createSectionInputSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .strict();
export type CreateSectionInput = z.infer<typeof createSectionInputSchema>;

export const createTableInputSchema = z
  .object({
    name: z.string().trim().min(1, "Give the table a name").max(80),
    /** Omit to take the next free number. */
    displayNumber: z.number().int().min(1).max(9999).optional(),
    sectionId: idSchema.nullable().default(null),
    shape: tableShapeSchema.default("rectangle"),
    chairCount: z.number().int().min(0).max(MAX_CHAIRS_PER_TABLE).default(0),
    chairKind: chairKindSchema.default("standard"),
  })
  .strict();
export type CreateTableInput = z.infer<typeof createTableInputSchema>;

export const updateTableInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    displayNumber: z.number().int().min(1).max(9999).optional(),
    sectionId: idSchema.nullable().optional(),
    shape: tableShapeSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type UpdateTableInput = z.infer<typeof updateTableInputSchema>;

export const addChairsInputSchema = z
  .object({
    count: z.number().int().min(1).max(MAX_CHAIRS_PER_TABLE),
    kind: chairKindSchema.default("standard"),
    /** Null leaves the new chairs unassigned, ready to be moved onto a table. */
    tableId: idSchema.nullable().default(null),
  })
  .strict();
export type AddChairsInput = z.infer<typeof addChairsInputSchema>;

export const updateChairInputSchema = z
  .object({
    label: z.string().trim().min(1).max(40).nullable().optional(),
    kind: chairKindSchema.optional(),
    /** Move to another table, or null to unassign. */
    tableId: idSchema.nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type UpdateChairInput = z.infer<typeof updateChairInputSchema>;

/** One tap: mark a single chair taken/free. `version` guards against a stale screen. */
export const setChairOccupiedInputSchema = z
  .object({
    occupied: z.boolean(),
    version: z.number().int().min(0).optional(),
  })
  .strict();
export type SetChairOccupiedInput = z.infer<typeof setChairOccupiedInputSchema>;

export const seatTableInputSchema = z
  .object({ guests: z.number().int().min(1).max(MAX_CHAIRS_PER_TABLE).optional() })
  .strict();

export type FloorChair = {
  id: string;
  tableId: string | null;
  label: string | null;
  kind: ChairKind;
  occupied: boolean;
  occupiedAt: string | null;
  version: number;
};

export type FloorSection = { id: string; name: string; color: string; sortOrder: number };

export type FloorTableState = "empty" | "partial" | "full" | "no_chairs";

export type FloorTableOverview = {
  /** The permanent system identifier. Never changes when a table is renamed or renumbered. */
  id: string;
  displayNumber: number;
  name: string;
  shape: TableShape;
  sectionId: string | null;
  chairs: FloorChair[];
  maxOccupancy: number;
  currentOccupancy: number;
  state: FloorTableState;
  /** Service signals for context only; they never change chair state. */
  activeOrders: number;
  unpaidOrders: number;
  nextReservation: { id: string; guestName: string; partySize: number; time: string } | null;
  qrCode: { id: string; destinationToken: string; label: string } | null;
  /** True when guests have been seated for a long time with no open order. */
  stale: boolean;
  /** Live guest-journey indicators. Null when the outlet has not enabled live table signals. */
  journey?: TableJourney | null;
};

export type FloorTotals = {
  tables: number;
  chairs: number;
  maxOccupancy: number;
  currentOccupancy: number;
  sections: number;
  tablesOccupied: number;
};

export const signalSettingsInputSchema = z
  .object({
    enabled: z.boolean().optional(),
    qrScanPings: z.boolean().optional(),
    guestWaterButton: z.boolean().optional(),
    showKitchen: z.boolean().optional(),
    showPosBill: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type SignalSettingsInput = z.infer<typeof signalSettingsInputSchema>;

/** Optional live table signals. Everything defaults to off at the outlet level. */
export type FloorSignalSettings = {
  enabled: boolean;
  qrScanPings: boolean;
  guestWaterButton: boolean;
  showKitchen: boolean;
  showPosBill: boolean;
};

export type JourneyStepKey =
  "qr" | "order" | "cooking" | "ready" | "delivered" | "bill" | "paid" | "water";
/** idle: not happened; active: happening now or waiting on staff; done: completed. */
export type JourneyStepState = "idle" | "active" | "done";
export type JourneyStep = {
  key: JourneyStepKey;
  state: JourneyStepState;
  /** ISO time of the event this step reflects, if any. */
  at: string | null;
  /** Short factual detail, e.g. "2 dishes". Never contains guest names or phone numbers. */
  detail: string | null;
};
export type TableJourney = {
  steps: JourneyStep[];
  /** True while a guest request (water or bill) is waiting for staff. */
  needsStaff: boolean;
};

export type FloorOverview = {
  /** For the owner toggle; when `enabled` is false no indicators are computed. */
  signalSettings?: FloorSignalSettings;
  sections: FloorSection[];
  tables: FloorTableOverview[];
  unassignedChairs: FloorChair[];
  totals: FloorTotals;
  /** Next reservation anywhere on the floor, for the hero line. */
  nextReservation: { guestName: string; partySize: number; time: string } | null;
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
