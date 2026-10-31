import { and, eq, gte, sql } from "drizzle-orm";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
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

/** The floor document cannot invent or delete physical tables. */
export async function saveFloorLayout(actor: Actor, outletId: string, doc: FloorLayoutDoc): Promise<FloorLayoutDoc> {
  const validated = floorLayoutDocSchema.parse(doc);
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const active = await tx.select({ id: restaurantTables.id }).from(restaurantTables)
      .where(and(eq(restaurantTables.restaurantId, outletId), eq(restaurantTables.isActive, true)));
    const ids = new Set(active.map((t) => t.id));
    if (new Set(validated.tables.map((t) => t.id)).size !== ids.size
      || validated.tables.some((t) => !ids.has(t.id))) {
      throw new ConflictError("Table inventory changed; refresh the floor before saving.");
    }
    for (const table of validated.tables) {
      await tx.update(restaurantTables).set({
        tableNumber: table.tableNumber, label: table.label, capacity: table.capacity
      }).where(and(eq(restaurantTables.restaurantId, outletId), eq(restaurantTables.id, table.id)));
    }
    await tx.insert(diningFloorPlans).values({ outletId, layout: validated, updatedAt: new Date() })
      .onConflictDoUpdate({ target: diningFloorPlans.outletId,
        set: { layout: validated, updatedAt: new Date() } });
    return validated;
  });
}

/** Create a physical table and visual placement in one transaction. */
export async function createFloorTable(actor: Actor, outletId: string, table: VisualTable, doc: FloorLayoutDoc): Promise<FloorLayoutDoc> {
  const layout = floorLayoutDocSchema.parse(doc);
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const active = await tx.select({ id: restaurantTables.id }).from(restaurantTables)
      .where(and(eq(restaurantTables.restaurantId, outletId), eq(restaurantTables.isActive, true)));
    const existing = new Set(active.map((t) => t.id));
    const incoming = new Set(layout.tables.map((t) => t.id));
    if (existing.has(table.id) || incoming.size !== existing.size + 1 || !incoming.has(table.id)
      || [...existing].some((id) => !incoming.has(id))) {
      throw new ConflictError("Table inventory changed; refresh before creating a table.");
    }
    await tx.insert(restaurantTables).values({
      id: table.id, restaurantId: outletId, tableNumber: table.tableNumber,
      label: table.label, capacity: table.capacity, isActive: true
    });
    await tx.insert(diningFloorPlans).values({ outletId, layout, updatedAt: new Date() })
      .onConflictDoUpdate({ target: diningFloorPlans.outletId,
        set: { layout, updatedAt: new Date() } });
    return layout;
  });
}

/** Never archive an actively used table or its associated QR code. */
export async function deleteTable(actor: Actor, outletId: string, tableId: string, doc: FloorLayoutDoc): Promise<FloorLayoutDoc> {
  const layout = floorLayoutDocSchema.parse(doc);
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const active = await tx.select({ id: restaurantTables.id }).from(restaurantTables)
      .where(and(eq(restaurantTables.restaurantId, outletId), eq(restaurantTables.isActive, true)));
    const existing = new Set(active.map((t) => t.id));
    const expected = new Set([...existing].filter((id) => id !== tableId));
    if (!existing.has(tableId)) throw new NotFoundError("Active table");
    if (new Set(layout.tables.map((t) => t.id)).size !== expected.size
        || layout.tables.some((t) => !expected.has(t.id))) {
      throw new ConflictError("Table inventory changed; refresh before archiving.");
    }
    const blocked = await tx.execute<{ blocked: boolean }>(sql`
      select (exists(select 1 from orders where restaurant_id=${outletId} and table_id=${tableId}
        and (status in ('pending','accepted','preparing','ready') or payment_status='unpaid'))
      or exists(select 1 from dining_reservations where outlet_id=${outletId} and table_id=${tableId}
        and status in ('confirmed','seated'))
      or exists(select 1 from qr_codes where restaurant_id=${outletId} and table_id=${tableId} and is_active)) as blocked`);
    if (blocked.rows[0]?.blocked) throw new ConflictError("Table has active orders, bookings or QR codes. Resolve them before archiving.");
    await tx.update(restaurantTables).set({ isActive: false })
      .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.restaurantId, outletId)));
    await tx.insert(diningFloorPlans).values({ outletId, layout, updatedAt: new Date() })
      .onConflictDoUpdate({ target: diningFloorPlans.outletId,
        set: { layout, updatedAt: new Date() } });
    return layout;
  });
}

/** Reservations are fetched for the outlet's business day, never the server's day. */
export async function getReservations(
  actor: Actor, outletId: string, localDate?: string
): Promise<ReservationItem[]> {
  if (localDate && !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new ValidationError("Invalid booking date");
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const window = await tx.execute<{ start: Date; finish: Date }>(sql`
      select (coalesce(${localDate ?? null}::date,(now() at time zone timezone)::date)::timestamp
        at time zone timezone) as start,
        ((coalesce(${localDate ?? null}::date,(now() at time zone timezone)::date) + 1)::timestamp
        at time zone timezone) as finish
      from restaurants where id=${outletId}`);
    const start = window.rows[0]?.start;
    const finish = window.rows[0]?.finish;
    if (!start || !finish) throw new NotFoundError("Outlet");
    const rows = await tx.select().from(diningReservations).where(and(
      eq(diningReservations.outletId, outletId),
      gte(diningReservations.reservationTime, start),
      sql`${diningReservations.reservationTime} < ${finish}`
    )).orderBy(diningReservations.reservationTime);
    return rows.map(toReservationItem);
  });
}
function toReservationItem(r: DiningReservation): ReservationItem {
  return {
    id: r.id, outletId: r.outletId, tableId: r.tableId,
    guestName: r.guestName, guestPhone: r.guestPhone, guestEmail: r.guestEmail,
    partySize: r.partySize, reservationTime: r.reservationTime.toISOString(),
    durationMinutes: r.durationMinutes, status: r.status as ReservationItem["status"],
    notes: r.notes, createdAt: r.createdAt.toISOString()
  };
}

/** The table-row lock serializes bookings for the same table. */
export async function createReservation(
  actor: Actor, outletId: string, input: CreateReservationInput
): Promise<ReservationItem> {
  if (!input.tableId) throw new ValidationError("Select a table before confirming a booking.");
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    const time = new Date(input.reservationTime);
    if (!Number.isFinite(time.getTime()) || time.getTime() < Date.now() - 5 * 60_000)
      throw new ValidationError("Select a future reservation time.");
    const physical = await tx.execute<{ capacity: number | null }>(sql`
      select capacity from restaurant_tables
      where id=${input.tableId} and restaurant_id=${outletId} and is_active FOR UPDATE`);
    if (!physical.rows[0]) throw new ValidationError("Select an active table in this outlet.");
    if (input.partySize > (physical.rows[0].capacity ?? 0))
      throw new ValidationError("Party exceeds the seating capacity of this table.");
    const overlap = await tx.execute<{ booked: boolean }>(sql`
      select exists(select 1 from dining_reservations
        where outlet_id=${outletId} and table_id=${input.tableId}
          and status in ('confirmed','seated')
          and reservation_time < (${time}::timestamptz + (${input.durationMinutes} * interval '1 minute'))
          and (reservation_time + (duration_minutes * interval '1 minute')) > ${time}::timestamptz
      ) as booked`);
    if (overlap.rows[0]?.booked) throw new ConflictError("This table is already booked for the selected time.");
    const id = crypto.randomUUID();
    const [created] = await tx.insert(diningReservations).values({
      id, outletId, tableId: input.tableId, guestName: input.guestName,
      guestPhone: input.guestPhone ?? null, guestEmail: input.guestEmail ?? null,
      partySize: input.partySize, reservationTime: time,
      durationMinutes: input.durationMinutes, status: "confirmed", notes: input.notes ?? null
    }).returning();
    await tx.execute(sql`
      insert into audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
      values(gen_random_uuid()::text,${actor.userId},${outletId},'reservation.created','reservation',${id})`);
    return toReservationItem(created!);
  });
}

/** Allowed transitions form a one-way operator lifecycle, with audit evidence. */
export async function updateReservationStatus(
  actor: Actor, outletId: string, reservationId: string,
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show"
): Promise<void> {
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    const [current] = await tx.select().from(diningReservations).where(and(
      eq(diningReservations.id, reservationId), eq(diningReservations.outletId, outletId)
    )).for("update").limit(1);
    if (!current) throw new NotFoundError("Reservation");
    if (current.status === status) return;
    const allowed: Record<string, string[]> = {
      confirmed: ["seated", "cancelled", "no_show"], seated: ["completed"],
      completed: [], cancelled: [], no_show: []
    };
    if (!allowed[current.status]?.includes(status))
      throw new ConflictError("This reservation cannot move to the requested status.");
    await tx.update(diningReservations).set({ status }).where(and(
      eq(diningReservations.id, reservationId), eq(diningReservations.outletId, outletId)
    ));
    await tx.execute(sql`
      insert into audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id,before,after)
      values(gen_random_uuid()::text,${actor.userId},${outletId},'reservation.status.changed',
        'reservation',${reservationId},${current.status},${status})`);
  });
}

/** Attach or reuse a QR that actually points at the selected physical table. */
export async function attachExistingTableQr(actor: Actor, outletId: string, tableId: string) {
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const existing = await tx.select({ tableNumber: restaurantTables.tableNumber })
      .from(restaurantTables).where(and(
        eq(restaurantTables.id, tableId), eq(restaurantTables.restaurantId, outletId),
        eq(restaurantTables.isActive, true)
      )).limit(1);
    if (!existing[0]) throw new NotFoundError("Active outlet table");
    const result = await tx.execute<{ record: { id: string; token: string; tableId: string } }>(sql`
      select app_private.attach_existing_table_qr(${outletId},${tableId},
      ${"Table " + existing[0].tableNumber}) as record`);
    return result.rows[0]!.record;
  });
}
