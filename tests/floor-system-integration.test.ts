import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createFloorTable, deleteTable, getFloorLayout, attachExistingTableQr,
  createReservation, getReservations, updateReservationStatus } from "../src/modules/hospitality/floor-service";
import { floorLayoutDocSchema, type VisualTable } from "../src/modules/hospitality/floor-contracts";

const migrationUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: migrationUrl, max: 2 });
const suffix = crypto.randomUUID().slice(0, 8);
const actorId = `floor-qa-user-${suffix}`;
const outletId = `floor-qa-outlet-${suffix}`;
const tableId = `floor-qa-table-${suffix}`;
const actor = { userId: actorId };

const table: VisualTable = {
  id: tableId, tableNumber: "1", label: "Window", capacity: 4, shape: "round",
  x: 100, y: 100, width: 110, height: 110, rotation: 0,
  section: "Main Dining", assignedStaff: null,
};
const initialLayout = floorLayoutDocSchema.parse({
  version: 1, revision: 0,
  canvas: { width: 1400, height: 900, gridSnap: 20 },
  sections: [{ id: "main", name: "Main Dining", color: "#f59e0b" }],
  tables: [table],
});

describe("floor integrity against real PostgreSQL", () => {
  beforeAll(async () => {
    const c = await owner.connect();
    try {
      await c.query("begin");
      await c.query(
        "insert into users(id,name,email,email_verified) values($1,'Floor QA',$2,true)",
        [actorId, `floor-qa-${suffix}@example.test`]
      );
      await c.query("select set_config('app.actor_id',$1,true)", [actorId]);
      await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
        outletId, `floor-qa-public-${suffix}`,
        JSON.stringify({ name: "Floor QA", country: "IN", currency: "INR",
          timezone: "Asia/Kolkata", outletType: "restaurant", svgData: "<svg/>" })
      ]);
      await c.query("commit");
    } catch (error) {
      await c.query("rollback");
      throw error;
    } finally {
      c.release();
    }
  }, 60000);

  afterAll(async () => {
    await owner.end();
  });

  it("keeps one physical table and its attached QR across refreshes", async () => {
    const created = await createFloorTable(actor, outletId, table, initialLayout);
    expect(created.revision).toBe(1);
    const fresh = await getFloorLayout(actor, outletId);
    expect(fresh.tables.map((t) => t.id)).toEqual([tableId]);

    const a = await attachExistingTableQr(actor, outletId, tableId);
    const b = await attachExistingTableQr(actor, outletId, tableId);
    expect(b).toEqual(a);
    expect(a.tableId).toBe(tableId);
    const physical = await owner.query(
      "select id from restaurant_tables where restaurant_id=$1 and is_active", [outletId]
    );
    expect(physical.rows.map((r) => r.id)).toEqual([tableId]);

    await expect(deleteTable(actor, outletId, tableId, {
      ...created, revision: 1, tables: [],
    })).rejects.toThrow(/active orders, bookings or QR codes/i);
  });

  it("rejects overlapping reservations and invalid lifecycle transitions", async () => {
    const start = new Date(Date.now() + 3 * 86400000).toISOString();
    const reservation = await createReservation(actor, outletId, {
      tableId, guestName: "Guest One", partySize: 2, reservationTime: start,
      durationMinutes: 90,
    });
    expect(reservation.status).toBe("confirmed");
    await expect(createReservation(actor, outletId, {
      tableId, guestName: "Guest Two", partySize: 2,
      reservationTime: new Date(Date.parse(start) + 30 * 60000).toISOString(),
      durationMinutes: 90,
    })).rejects.toThrow(/already booked/i);
    await expect(createReservation(actor, outletId, {
      tableId, guestName: "Over capacity", partySize: 8, reservationTime: start,
      durationMinutes: 90,
    })).rejects.toThrow(/seating capacity/i);
    await updateReservationStatus(actor, outletId, reservation.id, "seated");
    await updateReservationStatus(actor, outletId, reservation.id, "completed");
    await expect(updateReservationStatus(actor, outletId, reservation.id, "confirmed"))
      .rejects.toThrow(/cannot move/i);

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date(start));
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date(start));
    const value = (field: string) => dateParts.find((part) => part.type === field)?.value ?? "";
    const localDate = `${value("year")}-${value("month")}-${value("day")}`;
    expect(day).toBeTruthy();
    expect((await getReservations(actor, outletId, localDate)).some((r) => r.id === reservation.id)).toBe(true);
  });
});
