import { and, asc, eq, gte, sql } from "drizzle-orm";
import { withPlanCap } from "@/modules/plans/store";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";
import { withOutlet, withOutletRead, type Actor } from "@/modules/tenancy/service";
import {
  diningReservations,
  diningSections,
  restaurantChairs,
  restaurantTables,
  type DiningReservation,
} from "@/db/schema";
import { buildJourney, DEFAULT_SIGNAL_SETTINGS, type SignalEventInput } from "./floor-signals";
import {
  MAX_TABLES_PER_OUTLET,
  type AddChairsInput,
  type CreateReservationInput,
  type CreateSectionInput,
  type CreateTableInput,
  type FloorChair,
  type FloorOverview,
  type FloorSection,
  type FloorSignalSettings,
  type SignalSettingsInput,
  type FloorTableOverview,
  type ReservationItem,
  type UpdateChairInput,
  type UpdateTableInput,
} from "./floor-contracts";

/** Hours after which seated guests with no open order are flagged "still occupied?". */
const STALE_OCCUPANCY_HOURS = 4;

/** Translate database constraint failures into friendly, typed application errors. */
async function guard<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const e = error as {
      code?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    const code = e.cause?.code ?? e.code;
    const message = e.cause?.message ?? e.message ?? "";
    if (code === "23505") throw new ConflictError("That table number or name is already in use.");
    if (code === "40001")
      throw new ConflictError("Someone else just changed this. The floor has been refreshed.");
    if (code === "22023") throw new ValidationError(message);
    if (code === "42501") throw new ForbiddenError();
    throw error;
  }
}

const iso = (value: unknown): string => new Date(value as string | Date).toISOString();

function chairId(index: number): string {
  // Time-ordered prefix keeps chairs in creation order; the suffix keeps ids unique.
  return `chr_${Date.now().toString(36)}${index.toString(36).padStart(2, "0")}${crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 10)}`;
}

function toChair(row: {
  id: string;
  tableId: string | null;
  label: string | null;
  kind: string;
  occupiedAt: Date | string | null;
  version: number;
}): FloorChair {
  return {
    id: row.id,
    tableId: row.tableId,
    label: row.label,
    kind: row.kind as FloorChair["kind"],
    occupied: row.occupiedAt !== null,
    occupiedAt: row.occupiedAt ? iso(row.occupiedAt) : null,
    version: row.version,
  };
}

/**
 * Everything the floor page renders, in one read. Occupancy comes only from chair state set by
 * staff; orders and reservations are shown as context and never change it.
 */
export async function getFloorOverview(actor: Actor, outletId: string): Promise<FloorOverview> {
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const [sectionRows, tableRows, chairRows] = await Promise.all([
      tx
        .select()
        .from(diningSections)
        .where(eq(diningSections.outletId, outletId))
        .orderBy(asc(diningSections.sortOrder), asc(diningSections.name)),
      tx
        .select()
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.restaurantId, outletId),
            eq(restaurantTables.isActive, true),
            sql`${restaurantTables.displayNumber} is not null`
          )
        )
        .orderBy(asc(restaurantTables.displayNumber))
        .limit(MAX_TABLES_PER_OUTLET),
      tx
        .select({
          id: restaurantChairs.id,
          tableId: restaurantChairs.tableId,
          label: restaurantChairs.label,
          kind: restaurantChairs.kind,
          occupiedAt: restaurantChairs.occupiedAt,
          version: restaurantChairs.version,
        })
        .from(restaurantChairs)
        .where(and(eq(restaurantChairs.outletId, outletId), eq(restaurantChairs.isActive, true)))
        .orderBy(asc(restaurantChairs.createdAt), asc(restaurantChairs.id)),
    ]);

    const orderRows = await tx.execute<{ table_id: string; active: number; unpaid: number }>(sql`
      select table_id,
        count(*) filter (where status in ('pending','accepted','preparing','ready'))::int as active,
        count(*) filter (where payment_status='unpaid')::int as unpaid
      from orders
      where restaurant_id=${outletId} and table_id is not null
        and (status in ('pending','accepted','preparing','ready')
          or (payment_status='unpaid' and status in ('served','collected','delivered')))
      group by table_id`);
    const reservationRows = await tx.execute<{
      id: string;
      table_id: string | null;
      guest_name: string;
      party_size: number;
      reservation_time: string | Date;
    }>(sql`
      select id, table_id, guest_name, party_size, reservation_time
      from dining_reservations
      where outlet_id=${outletId} and status='confirmed'
        and reservation_time >= now() - interval '30 minutes'
        and reservation_time < now() + interval '24 hours'
      order by reservation_time, id`);
    const qrRows = await tx.execute<{
      id: string;
      table_id: string;
      destination_token: string;
      label: string;
    }>(sql`
      select distinct on (table_id) id, table_id, destination_token, label
      from qr_codes
      where restaurant_id=${outletId} and table_id is not null and is_active
      order by table_id, created_at, id`);

    const settingsRow = (
      await tx.execute<{
        enabled: boolean;
        qr_scan_pings: boolean;
        guest_water_button: boolean;
        show_kitchen: boolean;
        show_pos_bill: boolean;
      }>(sql`select enabled, qr_scan_pings, guest_water_button, show_kitchen, show_pos_bill
        from floor_signal_settings where outlet_id=${outletId}`)
    ).rows[0];
    const signalSettings: FloorSignalSettings = settingsRow
      ? {
          enabled: settingsRow.enabled,
          qrScanPings: settingsRow.qr_scan_pings,
          guestWaterButton: settingsRow.guest_water_button,
          showKitchen: settingsRow.show_kitchen,
          showPosBill: settingsRow.show_pos_bill,
        }
      : DEFAULT_SIGNAL_SETTINGS;
    // Indicators are optional: with the switch off, no signal or journey query runs at all.
    const eventsByTable = new Map<string, SignalEventInput[]>();
    const journeyOrders = new Map<
      string,
      {
        id: string;
        status: string;
        paymentStatus: string;
        createdAt: string;
        updatedAt: string;
        dishCount: number;
      }
    >();
    if (signalSettings.enabled) {
      const events = await tx.execute<{
        table_id: string;
        kind: string;
        occurred_at: string | Date;
        ref_id: string | null;
      }>(
        sql`select table_id, kind, occurred_at, ref_id from table_signal_events
          where outlet_id=${outletId} and occurred_at > now() - interval '6 hours'
          order by occurred_at desc limit 2000`
      );
      for (const e of events.rows)
        eventsByTable.set(e.table_id, [
          ...(eventsByTable.get(e.table_id) ?? []),
          { kind: e.kind, occurredAt: iso(e.occurred_at), refId: e.ref_id },
        ]);
      const latestOrders = await tx.execute<{
        id: string;
        table_id: string;
        status: string;
        payment_status: string;
        created_at: string | Date;
        updated_at: string | Date;
        dishes: number;
      }>(sql`select distinct on (o.table_id) o.id, o.table_id, o.status, o.payment_status,
          o.created_at, o.updated_at,
          (select coalesce(sum(i.quantity),0)::int from order_items i where i.order_id=o.id) as dishes
        from orders o
        where o.restaurant_id=${outletId} and o.table_id is not null
          and o.created_at > now() - interval '6 hours'
        order by o.table_id, o.created_at desc, o.id desc`);
      for (const o of latestOrders.rows)
        journeyOrders.set(o.table_id, {
          id: o.id,
          status: o.status,
          paymentStatus: o.payment_status,
          createdAt: iso(o.created_at),
          updatedAt: iso(o.updated_at),
          dishCount: o.dishes,
        });
    }

    const orders = new Map(orderRows.rows.map((r) => [r.table_id, r]));
    const qrs = new Map(qrRows.rows.map((r) => [r.table_id, r]));
    const nextByTable = new Map<string, (typeof reservationRows.rows)[number]>();
    for (const r of reservationRows.rows)
      if (r.table_id && !nextByTable.has(r.table_id)) nextByTable.set(r.table_id, r);

    const chairs = chairRows.map(toChair);
    const byTable = new Map<string, FloorChair[]>();
    const unassignedChairs: FloorChair[] = [];
    for (const chair of chairs) {
      if (!chair.tableId) unassignedChairs.push(chair);
      else byTable.set(chair.tableId, [...(byTable.get(chair.tableId) ?? []), chair]);
    }

    const staleBefore = Date.now() - STALE_OCCUPANCY_HOURS * 3_600_000;
    const tables: FloorTableOverview[] = tableRows.map((t) => {
      const own = byTable.get(t.id) ?? [];
      const taken = own.filter((c) => c.occupied);
      const o = orders.get(t.id);
      const next = nextByTable.get(t.id);
      const qr = qrs.get(t.id);
      return {
        id: t.id,
        displayNumber: t.displayNumber!,
        name: t.name ?? t.label ?? `Table ${t.displayNumber}`,
        shape: t.shape,
        sectionId: t.sectionId,
        chairs: own,
        maxOccupancy: own.length,
        currentOccupancy: taken.length,
        state:
          own.length === 0
            ? "no_chairs"
            : taken.length === 0
              ? "empty"
              : taken.length === own.length
                ? "full"
                : "partial",
        activeOrders: o?.active ?? 0,
        unpaidOrders: o?.unpaid ?? 0,
        nextReservation: next
          ? {
              id: next.id,
              guestName: next.guest_name,
              partySize: next.party_size,
              time: iso(next.reservation_time),
            }
          : null,
        qrCode: qr ? { id: qr.id, destinationToken: qr.destination_token, label: qr.label } : null,
        journey: buildJourney({
          settings: signalSettings,
          events: eventsByTable.get(t.id) ?? [],
          order: journeyOrders.get(t.id) ?? null,
        }),
        stale:
          taken.length > 0 &&
          (o?.active ?? 0) === 0 &&
          (o?.unpaid ?? 0) === 0 &&
          taken.every((c) => c.occupiedAt && new Date(c.occupiedAt).getTime() < staleBefore),
      };
    });

    const first = reservationRows.rows[0];
    return {
      signalSettings,
      sections: sectionRows.map<FloorSection>((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        sortOrder: s.sortOrder,
      })),
      tables,
      unassignedChairs,
      totals: {
        tables: tables.length,
        chairs: tables.reduce((n, t) => n + t.maxOccupancy, 0),
        maxOccupancy: tables.reduce((n, t) => n + t.maxOccupancy, 0),
        currentOccupancy: tables.reduce((n, t) => n + t.currentOccupancy, 0),
        sections: sectionRows.length,
        tablesOccupied: tables.filter((t) => t.currentOccupancy > 0).length,
      },
      nextReservation: first
        ? {
            guestName: first.guest_name,
            partySize: first.party_size,
            time: iso(first.reservation_time),
          }
        : null,
    };
  });
}

export async function createSection(
  actor: Actor,
  outletId: string,
  input: CreateSectionInput
): Promise<FloorSection> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      const count = await tx.execute<{ n: number }>(
        sql`select count(*)::int n from dining_sections where outlet_id=${outletId}`
      );
      if ((count.rows[0]?.n ?? 0) >= 24)
        throw new ValidationError("An outlet can have 24 sections.");
      const row = {
        id: crypto.randomUUID(),
        outletId,
        name: input.name,
        color: input.color ?? "#f59e0b",
        sortOrder: count.rows[0]?.n ?? 0,
      };
      await tx.insert(diningSections).values(row);
      return { id: row.id, name: row.name, color: row.color, sortOrder: row.sortOrder };
    })
  );
}

async function assertSection(tx: import("@/db").Transaction, outletId: string, sectionId: string) {
  const [found] = await tx
    .select({ id: diningSections.id })
    .from(diningSections)
    .where(and(eq(diningSections.id, sectionId), eq(diningSections.outletId, outletId)))
    .limit(1);
  if (!found) throw new ValidationError("Choose a section that exists.");
}

async function insertChairs(
  tx: import("@/db").Transaction,
  outletId: string,
  tableId: string | null,
  kind: string,
  count: number
) {
  if (count < 1) return;
  const rows = Array.from(
    { length: count },
    (_, i) => sql`(${chairId(i)}, ${outletId}, ${tableId}, ${kind})`
  );
  // Explicit column list: occupancy columns are not writable by the application role.
  await tx.execute(
    sql`insert into restaurant_chairs(id, outlet_id, table_id, kind) values ${sql.join(rows, sql`, `)}`
  );
}

/** Create a table (name, number, section, shape) with its first chairs in one transaction. */
export async function createTable(
  actor: Actor,
  outletId: string,
  input: CreateTableInput
): Promise<{ id: string; displayNumber: number }> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", (tx) =>
      // Plan caps on numbered tables and chairs (no-op unless PLAN_LIMITS_ENFORCED). The table and
      // its first chairs commit or roll back together with the limit check.
      withPlanCap(tx, [outletId], "tables", () =>
        withPlanCap(tx, [outletId], "chairs", async () => {
          await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${outletId}, 87316))`);
          const total = await tx.execute<{ n: number }>(sql`
        select count(*)::int n from restaurant_tables
        where restaurant_id=${outletId} and is_active and display_number is not null`);
          if ((total.rows[0]?.n ?? 0) >= MAX_TABLES_PER_OUTLET)
            throw new ValidationError(`An outlet can have ${MAX_TABLES_PER_OUTLET} tables.`);
          if (input.sectionId) await assertSection(tx, outletId, input.sectionId);
          let displayNumber = input.displayNumber;
          if (!displayNumber) {
            const free = await tx.execute<{ n: number }>(sql`
          select g::int n from generate_series(1, 9999) g
          where not exists(select 1 from restaurant_tables
            where restaurant_id=${outletId} and is_active and display_number=g)
          order by g limit 1`);
            displayNumber = free.rows[0]?.n;
            if (!displayNumber) throw new ValidationError("No table numbers are left.");
          }
          const id = crypto.randomUUID();
          await tx.insert(restaurantTables).values({
            id,
            restaurantId: outletId,
            tableNumber: String(displayNumber),
            label: input.name,
            name: input.name,
            displayNumber,
            sectionId: input.sectionId,
            shape: input.shape,
            capacity: 0,
            isActive: true,
          });
          await insertChairs(tx, outletId, id, input.chairKind, input.chairCount);
          return { id, displayNumber };
        })
      )
    )
  );
}

export async function updateTable(
  actor: Actor,
  outletId: string,
  tableId: string,
  input: UpdateTableInput
): Promise<void> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      if (input.sectionId) await assertSection(tx, outletId, input.sectionId);
      const set: Partial<typeof restaurantTables.$inferInsert> = {};
      if (input.name !== undefined) {
        set.name = input.name;
        set.label = input.name;
      }
      if (input.displayNumber !== undefined) {
        set.displayNumber = input.displayNumber;
        set.tableNumber = String(input.displayNumber);
      }
      if (input.sectionId !== undefined) set.sectionId = input.sectionId;
      if (input.shape !== undefined) set.shape = input.shape;
      const updated = await tx
        .update(restaurantTables)
        .set(set)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.restaurantId, outletId),
            eq(restaurantTables.isActive, true),
            sql`${restaurantTables.displayNumber} is not null`
          )
        )
        .returning({ id: restaurantTables.id });
      if (!updated[0]) throw new NotFoundError("Table");
    })
  );
}

/**
 * Archive a table. Never an actively used one: open orders, bookings, a live QR or seated guests
 * block it. Its chairs are released to the unassigned tray, not deleted.
 */
export async function archiveTable(actor: Actor, outletId: string, tableId: string): Promise<void> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      const [table] = await tx
        .select({ id: restaurantTables.id })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.id, tableId),
            eq(restaurantTables.restaurantId, outletId),
            eq(restaurantTables.isActive, true)
          )
        )
        .for("update")
        .limit(1);
      if (!table) throw new NotFoundError("Table");
      const blocked = await tx.execute<{ blocked: boolean; seated: boolean }>(sql`
        select (exists(select 1 from orders where restaurant_id=${outletId} and table_id=${tableId}
          and (status in ('pending','accepted','preparing','ready') or payment_status='unpaid'))
        or exists(select 1 from dining_reservations where outlet_id=${outletId} and table_id=${tableId}
          and status in ('confirmed','seated'))
        or exists(select 1 from qr_codes where restaurant_id=${outletId} and table_id=${tableId} and is_active)) as blocked,
        exists(select 1 from restaurant_chairs where outlet_id=${outletId} and table_id=${tableId}
          and occupied_at is not null) as seated`);
      if (blocked.rows[0]?.seated)
        throw new ConflictError("Guests are seated here. Clear the table before archiving it.");
      if (blocked.rows[0]?.blocked)
        throw new ConflictError(
          "This table has active orders, bookings or a QR code. Resolve them before archiving."
        );
      await tx
        .update(restaurantChairs)
        .set({ tableId: null })
        .where(and(eq(restaurantChairs.outletId, outletId), eq(restaurantChairs.tableId, tableId)));
      await tx
        .update(restaurantTables)
        .set({ isActive: false })
        .where(and(eq(restaurantTables.id, tableId), eq(restaurantTables.restaurantId, outletId)));
    })
  );
}

async function assertFloorTable(tx: import("@/db").Transaction, outletId: string, tableId: string) {
  const [t] = await tx
    .select({ id: restaurantTables.id })
    .from(restaurantTables)
    .where(
      and(
        eq(restaurantTables.id, tableId),
        eq(restaurantTables.restaurantId, outletId),
        eq(restaurantTables.isActive, true),
        sql`${restaurantTables.displayNumber} is not null`
      )
    )
    .limit(1);
  if (!t) throw new NotFoundError("Table");
}

export async function addChairs(
  actor: Actor,
  outletId: string,
  input: AddChairsInput
): Promise<{ added: number }> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", (tx) =>
      withPlanCap(tx, [outletId], "chairs", async () => {
        if (input.tableId) await assertFloorTable(tx, outletId, input.tableId);
        await insertChairs(tx, outletId, input.tableId, input.kind, input.count);
        return { added: input.count };
      })
    )
  );
}

export async function updateChair(
  actor: Actor,
  outletId: string,
  chairIdValue: string,
  input: UpdateChairInput
): Promise<void> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      if (input.tableId) await assertFloorTable(tx, outletId, input.tableId);
      const set: Partial<typeof restaurantChairs.$inferInsert> = {};
      if (input.label !== undefined) set.label = input.label;
      if (input.kind !== undefined) set.kind = input.kind;
      if (input.tableId !== undefined) set.tableId = input.tableId;
      const updated = await tx
        .update(restaurantChairs)
        .set(set)
        .where(
          and(
            eq(restaurantChairs.id, chairIdValue),
            eq(restaurantChairs.outletId, outletId),
            eq(restaurantChairs.isActive, true)
          )
        )
        .returning({ id: restaurantChairs.id });
      if (!updated[0]) throw new NotFoundError("Chair");
    })
  );
}

export async function removeChair(
  actor: Actor,
  outletId: string,
  chairIdValue: string
): Promise<void> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      const [chair] = await tx
        .select({ occupiedAt: restaurantChairs.occupiedAt })
        .from(restaurantChairs)
        .where(and(eq(restaurantChairs.id, chairIdValue), eq(restaurantChairs.outletId, outletId)))
        .for("update")
        .limit(1);
      if (!chair) throw new NotFoundError("Chair");
      if (chair.occupiedAt) throw new ConflictError("Mark this chair free before removing it.");
      await tx
        .delete(restaurantChairs)
        .where(and(eq(restaurantChairs.id, chairIdValue), eq(restaurantChairs.outletId, outletId)));
    })
  );
}

/** One tap on a chair. Repeating the same state is a no-op; a stale version is a conflict. */
export async function setChairOccupied(
  actor: Actor,
  outletId: string,
  chairIdValue: string,
  occupied: boolean,
  version?: number
): Promise<{ id: string; occupied: boolean; version: number }> {
  return guard(() =>
    withOutlet(actor, outletId, "orders.accept", async (tx) => {
      const r = await tx.execute<{ r: { id: string; occupied: boolean; version: number } }>(sql`
        select app_private.floor_set_chair_occupied(${outletId}, ${chairIdValue}, ${occupied},
          ${version ?? null}::integer) as r`);
      return r.rows[0]!.r;
    })
  );
}

/** Seat a party: occupy up to `guests` free chairs (all free chairs when omitted). */
export async function seatTable(
  actor: Actor,
  outletId: string,
  tableId: string,
  guests?: number
): Promise<{ seated: number }> {
  return guard(() =>
    withOutlet(actor, outletId, "orders.accept", async (tx) => {
      const r = await tx.execute<{ n: number }>(sql`
        select app_private.floor_seat_table(${outletId}, ${tableId}, ${guests ?? null}::integer) as n`);
      return { seated: r.rows[0]!.n };
    })
  );
}

export async function clearTable(
  actor: Actor,
  outletId: string,
  tableId: string
): Promise<{ cleared: number }> {
  return guard(() =>
    withOutlet(actor, outletId, "orders.accept", async (tx) => {
      const r = await tx.execute<{ n: number }>(
        sql`select app_private.floor_clear_table(${outletId}, ${tableId}) as n`
      );
      return { cleared: r.rows[0]!.n };
    })
  );
}

/** Reservations are fetched for the outlet's business day, never the server's day. */
export async function getReservations(
  actor: Actor,
  outletId: string,
  localDate?: string
): Promise<ReservationItem[]> {
  if (localDate && !/^\d{4}-\d{2}-\d{2}$/.test(localDate))
    throw new ValidationError("Invalid booking date");
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const window = await tx.execute<{ start: string | Date; finish: string | Date }>(sql`
      select (coalesce(${localDate ?? null}::date,(now() at time zone timezone)::date)::timestamp
        at time zone timezone) as start,
        ((coalesce(${localDate ?? null}::date,(now() at time zone timezone)::date) + 1)::timestamp
        at time zone timezone) as finish
      from restaurants where id=${outletId}`);
    // PostgreSQL returns raw TIMESTAMPTZ expressions as strings through
    // execute(). Drizzle timestamp comparisons require actual Date instances.
    const row = window.rows[0];
    if (!row) throw new NotFoundError("Outlet");
    const start = row.start instanceof Date ? row.start : new Date(row.start);
    const finish = row.finish instanceof Date ? row.finish : new Date(row.finish);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(finish.getTime()))
      throw new ValidationError("Could not determine the outlet's reservation day");
    const rows = await tx
      .select()
      .from(diningReservations)
      .where(
        and(
          eq(diningReservations.outletId, outletId),
          gte(diningReservations.reservationTime, start),
          sql`${diningReservations.reservationTime} < ${finish}`
        )
      )
      .orderBy(diningReservations.reservationTime);
    return rows.map(toReservationItem);
  });
}
function toReservationItem(r: DiningReservation): ReservationItem {
  return {
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
  };
}

/** The table-row lock serializes bookings for the same table. */
export async function createReservation(
  actor: Actor,
  outletId: string,
  input: CreateReservationInput
): Promise<ReservationItem> {
  if (!input.tableId) throw new ValidationError("Select a table before confirming a booking.");
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    const time = new Date(input.reservationTime);
    if (!Number.isFinite(time.getTime()) || time.getTime() < Date.now() - 5 * 60_000)
      throw new ValidationError("Select a future reservation time.");
    const physical = await tx.execute<{ capacity: number }>(sql`
      select app_private.floor_booking_table_capacity(${outletId},${input.tableId}) as capacity`);
    if (input.partySize > physical.rows[0]!.capacity)
      throw new ValidationError("Party exceeds the seating capacity of this table.");
    const overlap = await tx.execute<{ booked: boolean }>(sql`
      select exists(select 1 from dining_reservations
        where outlet_id=${outletId} and table_id=${input.tableId}
          and status in ('confirmed','seated')
          and reservation_time < (${time}::timestamptz + (${input.durationMinutes} * interval '1 minute'))
          and (reservation_time + (duration_minutes * interval '1 minute')) > ${time}::timestamptz
      ) as booked`);
    if (overlap.rows[0]?.booked)
      throw new ConflictError("This table is already booked for the selected time.");
    const id = crypto.randomUUID();
    const [created] = await tx
      .insert(diningReservations)
      .values({
        id,
        outletId,
        tableId: input.tableId,
        guestName: input.guestName,
        guestPhone: input.guestPhone ?? null,
        guestEmail: input.guestEmail ?? null,
        partySize: input.partySize,
        reservationTime: time,
        durationMinutes: input.durationMinutes,
        status: "confirmed",
        notes: input.notes ?? null,
      })
      .returning();
    await tx.execute(sql`
      select app_private.floor_reservation_audit(${outletId},${id},
        null::text,'confirmed'::text)`);
    return toReservationItem(created!);
  });
}

/** Allowed transitions form a one-way operator lifecycle, with audit evidence. */
export async function updateReservationStatus(
  actor: Actor,
  outletId: string,
  reservationId: string,
  status: "confirmed" | "seated" | "completed" | "cancelled" | "no_show"
): Promise<void> {
  return withOutlet(actor, outletId, "orders.accept", async (tx) => {
    const [current] = await tx
      .select()
      .from(diningReservations)
      .where(
        and(eq(diningReservations.id, reservationId), eq(diningReservations.outletId, outletId))
      )
      .for("update")
      .limit(1);
    if (!current) throw new NotFoundError("Reservation");
    if (current.status === status) return;
    const allowed: Record<string, string[]> = {
      confirmed: ["seated", "cancelled", "no_show"],
      seated: ["completed"],
      completed: [],
      cancelled: [],
      no_show: [],
    };
    if (!allowed[current.status]?.includes(status))
      throw new ConflictError("This reservation cannot move to the requested status.");
    await tx
      .update(diningReservations)
      .set({ status })
      .where(
        and(eq(diningReservations.id, reservationId), eq(diningReservations.outletId, outletId))
      );
    await tx.execute(sql`
      select app_private.floor_reservation_audit(${outletId},${reservationId},
        ${current.status},${status})`);
  });
}

/** Attach or reuse a QR that actually points at the selected physical table. */
export async function attachExistingTableQr(actor: Actor, outletId: string, tableId: string) {
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const existing = await tx
      .select({ tableNumber: restaurantTables.tableNumber })
      .from(restaurantTables)
      .where(
        and(
          eq(restaurantTables.id, tableId),
          eq(restaurantTables.restaurantId, outletId),
          eq(restaurantTables.isActive, true)
        )
      )
      .limit(1);
    if (!existing[0]) throw new NotFoundError("Active outlet table");
    const result = await tx.execute<{ record: { id: string; token: string; tableId: string } }>(sql`
      select app_private.attach_existing_table_qr(${outletId},${tableId},
      ${"Table " + existing[0].tableNumber}) as record`);
    return result.rows[0]!.record;
  });
}

/**
 * Owner switch for live table signals. Defaults to off; changing it never touches orders, kitchen
 * or POS state. Needs menu.write like the rest of the floor structure.
 */
export async function updateSignalSettings(
  actor: Actor,
  outletId: string,
  input: SignalSettingsInput
): Promise<FloorSignalSettings> {
  return guard(() =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      const next = {
        enabled: input.enabled,
        qrScanPings: input.qrScanPings,
        guestWaterButton: input.guestWaterButton,
        showKitchen: input.showKitchen,
        showPosBill: input.showPosBill,
      };
      const row = (
        await tx.execute<{
          enabled: boolean;
          qr_scan_pings: boolean;
          guest_water_button: boolean;
          show_kitchen: boolean;
          show_pos_bill: boolean;
        }>(sql`insert into floor_signal_settings
          (outlet_id, enabled, qr_scan_pings, guest_water_button, show_kitchen, show_pos_bill, updated_by)
          values (${outletId},
            ${next.enabled ?? DEFAULT_SIGNAL_SETTINGS.enabled},
            ${next.qrScanPings ?? DEFAULT_SIGNAL_SETTINGS.qrScanPings},
            ${next.guestWaterButton ?? DEFAULT_SIGNAL_SETTINGS.guestWaterButton},
            ${next.showKitchen ?? DEFAULT_SIGNAL_SETTINGS.showKitchen},
            ${next.showPosBill ?? DEFAULT_SIGNAL_SETTINGS.showPosBill},
            ${actor.userId})
          on conflict (outlet_id) do update set
            enabled = coalesce(${next.enabled ?? null}::boolean, floor_signal_settings.enabled),
            qr_scan_pings = coalesce(${next.qrScanPings ?? null}::boolean, floor_signal_settings.qr_scan_pings),
            guest_water_button = coalesce(${next.guestWaterButton ?? null}::boolean, floor_signal_settings.guest_water_button),
            show_kitchen = coalesce(${next.showKitchen ?? null}::boolean, floor_signal_settings.show_kitchen),
            show_pos_bill = coalesce(${next.showPosBill ?? null}::boolean, floor_signal_settings.show_pos_bill),
            revision = floor_signal_settings.revision + 1,
            updated_by = ${actor.userId},
            updated_at = now()
          returning enabled, qr_scan_pings, guest_water_button, show_kitchen, show_pos_bill`)
      ).rows[0]!;
      return {
        enabled: row.enabled,
        qrScanPings: row.qr_scan_pings,
        guestWaterButton: row.guest_water_button,
        showKitchen: row.show_kitchen,
        showPosBill: row.show_pos_bill,
      };
    })
  );
}
