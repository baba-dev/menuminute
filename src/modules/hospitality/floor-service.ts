import { and, eq, gte, lte } from "drizzle-orm";
import { withOutlet, withOutletRead, type Actor } from "@/modules/tenancy/service";
import {
  diningFloorPlans,
  diningReservations,
  restaurantTables,
  type DiningReservation,
} from "@/db/schema";
import {
  floorLayoutDocSchema,
  type FloorLayoutDoc,
  type VisualTable,
  type ReservationItem,
  type CreateReservationInput,
} from "./floor-contracts";

/**
 * Retrieves the dining floor layout for an outlet, merging physical restaurant_tables
 * with the visual layout coordinates and sections.
 */
export async function getFloorLayout(actor: Actor, outletId: string): Promise<FloorLayoutDoc> {
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    // 1. Fetch physical tables
    const dbTables = await tx
      .select({
        id: restaurantTables.id,
        tableNumber: restaurantTables.tableNumber,
        label: restaurantTables.label,
        capacity: restaurantTables.capacity,
        isActive: restaurantTables.isActive,
      })
      .from(restaurantTables)
      .where(and(eq(restaurantTables.restaurantId, outletId), eq(restaurantTables.isActive, true)))
      .orderBy(restaurantTables.tableNumber);

    // 2. Fetch saved visual layout plan
    const planRows = await tx
      .select({
        layout: diningFloorPlans.layout,
      })
      .from(diningFloorPlans)
      .where(eq(diningFloorPlans.outletId, outletId))
      .limit(1);

    const savedPlan = planRows[0]?.layout;
    const parsedPlan = floorLayoutDocSchema.safeParse(savedPlan);

    const defaultSections = [
      { id: "sec-main", name: "Main Dining", color: "#f59e0b" },
      { id: "sec-terrace", name: "Terrace", color: "#10b981" },
      { id: "sec-bar", name: "Bar & Lounge", color: "#8b5cf6" },
    ];

    let layout: FloorLayoutDoc;

    if (parsedPlan.success) {
      layout = parsedPlan.data;
      if (!layout.sections || layout.sections.length === 0) {
        layout.sections = defaultSections;
      }
    } else {
      layout = {
        version: 1,
        canvas: { width: 1400, height: 900, gridSnap: 20 },
        sections: defaultSections,
        tables: [],
      };
    }

    // 3. Reconcile tables: ensure every physical table from DB is represented in layout
    const visualTablesMap = new Map<string, VisualTable>();
    for (const vt of layout.tables) {
      visualTablesMap.set(vt.id, vt);
    }

    const mergedTables: VisualTable[] = [];
    let autoX = 140;
    let autoY = 140;

    for (const dt of dbTables) {
      const existing = visualTablesMap.get(dt.id);
      if (existing) {
        mergedTables.push({
          ...existing,
          tableNumber: dt.tableNumber,
          label: dt.label,
          capacity: dt.capacity || existing.capacity || 4,
        });
      } else {
        // Auto-arrange new unplaced table
        mergedTables.push({
          id: dt.id,
          tableNumber: dt.tableNumber,
          label: dt.label,
          capacity: dt.capacity || 4,
          shape:
            (dt.capacity || 4) <= 2 ? "round" : (dt.capacity || 4) <= 4 ? "square" : "rectangle",
          x: autoX,
          y: autoY,
          width: (dt.capacity || 4) <= 2 ? 85 : (dt.capacity || 4) <= 4 ? 100 : 140,
          height: (dt.capacity || 4) <= 2 ? 85 : 95,
          rotation: 0,
          section: layout.sections[0]?.name || "Main Dining",
          assignedStaff: null,
        });
        autoX += 160;
        if (autoX > 1000) {
          autoX = 140;
          autoY += 160;
        }
      }
    }

    return {
      ...layout,
      tables: mergedTables,
    };
  });
}

/**
 * Saves the entire visual layout doc and syncs table labels/capacities.
 */
export async function saveFloorLayout(
  actor: Actor,
  outletId: string,
  doc: FloorLayoutDoc
): Promise<FloorLayoutDoc> {
  const validated = floorLayoutDocSchema.parse(doc);

  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    // 1. Upsert floor plan
    await tx
      .insert(diningFloorPlans)
      .values({
        outletId,
        layout: validated,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: diningFloorPlans.outletId,
        set: {
          layout: validated,
          updatedAt: new Date(),
        },
      });

    // 2. Sync table metadata to restaurant_tables
    for (const vt of validated.tables) {
      await tx
        .update(restaurantTables)
        .set({
          tableNumber: vt.tableNumber,
          label: vt.label,
          capacity: vt.capacity,
        })
        .where(and(eq(restaurantTables.id, vt.id), eq(restaurantTables.restaurantId, outletId)));
    }

    return validated;
  });
}

/**
 * Creates or updates an individual table.
 */
export async function createOrUpdateTable(
  actor: Actor,
  outletId: string,
  table: VisualTable
): Promise<VisualTable> {
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    // Check if table already exists
    const existing = await tx
      .select({ id: restaurantTables.id })
      .from(restaurantTables)
      .where(and(eq(restaurantTables.id, table.id), eq(restaurantTables.restaurantId, outletId)))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(restaurantTables)
        .set({
          tableNumber: table.tableNumber,
          label: table.label,
          capacity: table.capacity,
          isActive: true,
        })
        .where(eq(restaurantTables.id, table.id));
    } else {
      await tx.insert(restaurantTables).values({
        id: table.id,
        restaurantId: outletId,
        tableNumber: table.tableNumber,
        label: table.label,
        capacity: table.capacity,
        isActive: true,
      });
    }

    return table;
  });
}

/**
 * Deactivates a table (archives it).
 */
export async function deleteTable(actor: Actor, outletId: string, tableId: string): Promise<void> {
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    await tx
      .update(restaurantTables)
      .set({ isActive: false })
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.restaurantId, outletId)));
  });
}

/**
 * Retrieves reservations for an outlet on a given day.
 */
export async function getReservations(
  actor: Actor,
  outletId: string,
  date: Date = new Date()
): Promise<ReservationItem[]> {
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const rows = await tx
      .select()
      .from(diningReservations)
      .where(
        and(
          eq(diningReservations.outletId, outletId),
          gte(diningReservations.reservationTime, startOfDay),
          lte(diningReservations.reservationTime, endOfDay)
        )
      )
      .orderBy(diningReservations.reservationTime);

    return rows.map((r: DiningReservation) => ({
      id: r.id,
      outletId: r.outletId,
      tableId: r.tableId,
      guestName: r.guestName,
      guestPhone: r.guestPhone,
      guestEmail: r.guestEmail,
      partySize: r.partySize,
      reservationTime: r.reservationTime.toISOString(),
      durationMinutes: r.durationMinutes,
      status: r.status as ReservationItem["status"],
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

/**
 * Creates a new reservation.
 */
export async function createReservation(
  actor: Actor,
  outletId: string,
  input: CreateReservationInput
): Promise<ReservationItem> {
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    const id = crypto.randomUUID();
    const resTime = new Date(input.reservationTime);

    await tx.insert(diningReservations).values({
      id,
      outletId,
      tableId: input.tableId || null,
      guestName: input.guestName,
      guestPhone: input.guestPhone || null,
      guestEmail: input.guestEmail || null,
      partySize: input.partySize,
      reservationTime: resTime,
      durationMinutes: input.durationMinutes || 90,
      status: "confirmed",
      notes: input.notes || null,
    });

    return {
      id,
      outletId,
      tableId: input.tableId || null,
      guestName: input.guestName,
      guestPhone: input.guestPhone || null,
      guestEmail: input.guestEmail || null,
      partySize: input.partySize,
      reservationTime: resTime.toISOString(),
      durationMinutes: input.durationMinutes || 90,
      status: "confirmed",
      notes: input.notes || null,
      createdAt: new Date().toISOString(),
    };
  });
}

/**
 * Updates a reservation status (e.g. seated, completed, cancelled).
 */
export async function updateReservationStatus(
  actor: Actor,
  outletId: string,
  reservationId: string,
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show"
): Promise<void> {
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    await tx
      .update(diningReservations)
      .set({ status })
      .where(
        and(eq(diningReservations.id, reservationId), eq(diningReservations.outletId, outletId))
      );
  });
}
