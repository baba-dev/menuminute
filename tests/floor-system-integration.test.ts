import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  addChairs,
  archiveTable,
  attachExistingTableQr,
  clearTable,
  createReservation,
  createSection,
  createTable,
  getFloorOverview,
  getReservations,
  removeChair,
  seatTable,
  setChairOccupied,
  updateChair,
  updateReservationStatus,
  updateSignalSettings,
  updateTable,
} from "../src/modules/hospitality/floor-service";

const migrationUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: migrationUrl, max: 2 });
const suffix = crypto.randomUUID().slice(0, 8);
const actorId = `floor-qa-user-${suffix}`;
const outletId = `floor-qa-outlet-${suffix}`;
const strangerId = `floor-qa-stranger-${suffix}`;
const strangerOutletId = `floor-qa-other-outlet-${suffix}`;
const actor = { userId: actorId };
const stranger = { userId: strangerId };
let tableId = "";
let sectionId = "";

async function provision(userId: string, outlet: string, label: string) {
  const c = await owner.connect();
  try {
    await c.query("begin");
    await c.query("insert into users(id,name,email,email_verified) values($1,'Floor QA',$2,true)", [
      userId,
      `${userId}@example.test`,
    ]);
    await c.query("select set_config('app.actor_id',$1,true)", [userId]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outlet,
      `${label}-${suffix}`,
      JSON.stringify({
        name: label,
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
        svgData: "<svg/>",
      }),
    ]);
    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  } finally {
    c.release();
  }
}

describe("floor v2 (tables, chairs, occupancy) against real PostgreSQL", () => {
  beforeAll(async () => {
    await provision(actorId, outletId, "Floor QA");
    await provision(strangerId, strangerOutletId, "Floor QA Other");
  }, 60000);

  afterAll(async () => {
    await owner.end();
  });

  it("creates a section and a table with chairs; capacity is derived from active chairs", async () => {
    const section = await createSection(actor, outletId, { name: "Main Dining" });
    sectionId = section.id;
    await expect(createSection(actor, outletId, { name: "main dining" })).rejects.toThrow(
      /already in use/i
    );
    const created = await createTable(actor, outletId, {
      name: "Window Booth",
      sectionId,
      shape: "booth",
      chairCount: 4,
      chairKind: "standard",
    });
    tableId = created.id;
    expect(created.displayNumber).toBe(1); // next free number
    const second = await createTable(actor, outletId, {
      name: "Patio",
      sectionId: null,
      shape: "round",
      chairCount: 0,
      chairKind: "standard",
    });
    expect(second.displayNumber).toBe(2);

    const overview = await getFloorOverview(actor, outletId);
    expect(overview.totals).toMatchObject({
      tables: 2,
      chairs: 4,
      maxOccupancy: 4,
      currentOccupancy: 0,
      sections: 1,
    });
    const t = overview.tables.find((x) => x.id === tableId)!;
    expect(t.chairs).toHaveLength(4);
    expect(t.state).toBe("empty");
    expect(overview.tables.find((x) => x.id === second.id)!.state).toBe("no_chairs");
    const cap = await owner.query("select capacity from restaurant_tables where id=$1", [tableId]);
    expect(cap.rows[0].capacity).toBe(4);
  });

  it("rejects a duplicate table number, including under concurrency, and reuses archived numbers", async () => {
    const attempts = await Promise.allSettled(
      [0, 1].map((i) =>
        createTable(actor, outletId, {
          name: `Race ${i}`,
          displayNumber: 40,
          sectionId: null,
          shape: "square",
          chairCount: 2,
          chairKind: "standard",
        })
      )
    );
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((a) => a.status === "rejected")).toHaveLength(1);
    const winner = attempts.find((a) => a.status === "fulfilled") as PromiseFulfilledResult<{
      id: string;
    }>;
    await archiveTable(actor, outletId, winner.value.id);
    const again = await createTable(actor, outletId, {
      name: "Reuse 40",
      displayNumber: 40,
      sectionId: null,
      shape: "square",
      chairCount: 0,
      chairKind: "standard",
    });
    expect(again.displayNumber).toBe(40);
    await updateTable(actor, outletId, again.id, { name: "Renamed", displayNumber: 41 });
    const row = await owner.query(
      "select name,label,table_number,display_number from restaurant_tables where id=$1",
      [again.id]
    );
    expect(row.rows[0]).toMatchObject({
      name: "Renamed",
      label: "Renamed",
      table_number: "41",
      display_number: 41,
    });
    await archiveTable(actor, outletId, again.id);
  });

  it("marks chairs occupied with one tap, idempotently, and guards stale screens", async () => {
    let overview = await getFloorOverview(actor, outletId);
    const chairs = overview.tables.find((t) => t.id === tableId)!.chairs;
    const first = chairs[0]!;
    const taken = await setChairOccupied(actor, outletId, first.id, true, first.version);
    expect(taken).toMatchObject({ occupied: true, version: first.version + 1 });
    // Same tap again (double tap / retry) is a no-op, not a conflict.
    expect(await setChairOccupied(actor, outletId, first.id, true, first.version)).toMatchObject({
      occupied: true,
      version: taken.version,
    });
    // A stale screen trying to free it with the old version loses.
    await expect(setChairOccupied(actor, outletId, first.id, false, first.version)).rejects.toThrow(
      /changed this|refreshed/i
    );
    const freed = await setChairOccupied(actor, outletId, first.id, false, taken.version);
    expect(freed.occupied).toBe(false);

    expect(await seatTable(actor, outletId, tableId, 3)).toEqual({ seated: 3 });
    overview = await getFloorOverview(actor, outletId);
    const t = overview.tables.find((x) => x.id === tableId)!;
    expect(t).toMatchObject({ currentOccupancy: 3, maxOccupancy: 4, state: "partial" });
    expect(overview.totals).toMatchObject({ currentOccupancy: 3, tablesOccupied: 1 });
    expect(await seatTable(actor, outletId, tableId)).toEqual({ seated: 1 }); // the remaining chair
    expect(
      (await getFloorOverview(actor, outletId)).tables.find((x) => x.id === tableId)!.state
    ).toBe("full");
    await expect(archiveTable(actor, outletId, tableId)).rejects.toThrow(/seated/i);
    expect(await clearTable(actor, outletId, tableId)).toEqual({ cleared: 4 });
    expect((await getFloorOverview(actor, outletId)).totals.currentOccupancy).toBe(0);
  });

  it("frees a chair when it moves, blocks removing an occupied chair, and enforces limits", async () => {
    const overview = await getFloorOverview(actor, outletId);
    const chair = overview.tables.find((t) => t.id === tableId)!.chairs[0]!;
    await setChairOccupied(actor, outletId, chair.id, true);
    await expect(removeChair(actor, outletId, chair.id)).rejects.toThrow(/free before removing/i);
    await updateChair(actor, outletId, chair.id, { tableId: null }); // unassign
    let after = await getFloorOverview(actor, outletId);
    expect(after.unassignedChairs.map((c) => c.id)).toContain(chair.id);
    expect(after.unassignedChairs.find((c) => c.id === chair.id)!.occupied).toBe(false);
    expect(after.tables.find((t) => t.id === tableId)!.maxOccupancy).toBe(3);
    // An unassigned chair cannot be occupied.
    await expect(setChairOccupied(actor, outletId, chair.id, true)).rejects.toThrow(
      /assigned chair/i
    );
    await updateChair(actor, outletId, chair.id, { tableId }); // assign back
    await addChairs(actor, outletId, { count: 26, kind: "standard", tableId });
    await expect(
      addChairs(actor, outletId, { count: 1, kind: "high_chair", tableId })
    ).rejects.toThrow(/at most 30/i);
    after = await getFloorOverview(actor, outletId);
    expect(after.tables.find((t) => t.id === tableId)!.maxOccupancy).toBe(30);
    const trimmed = after.tables.find((t) => t.id === tableId)!.chairs;
    for (const c of trimmed.slice(4)) await removeChair(actor, outletId, c.id);
    expect(
      (await getFloorOverview(actor, outletId)).tables.find((t) => t.id === tableId)!.maxOccupancy
    ).toBe(4);
  });

  it("isolates outlets and denies strangers", async () => {
    const overview = await getFloorOverview(actor, outletId);
    const chair = overview.tables.find((t) => t.id === tableId)!.chairs[0]!;
    await expect(getFloorOverview(stranger, outletId)).rejects.toThrow();
    await expect(setChairOccupied(stranger, outletId, chair.id, true)).rejects.toThrow();
    // The stranger's own outlet cannot touch another outlet's chair id either.
    await expect(setChairOccupied(stranger, strangerOutletId, chair.id, true)).rejects.toThrow(
      /assigned chair/i
    );
    await expect(
      updateChair(stranger, strangerOutletId, chair.id, { label: "hijack" })
    ).rejects.toThrow(/not found/i);
    await expect(
      createTable(stranger, strangerOutletId, {
        name: "Cross",
        sectionId,
        shape: "square",
        chairCount: 0,
        chairKind: "standard",
      })
    ).rejects.toThrow(/section that exists/i);
    const direct = await owner.query("select occupied_at from restaurant_chairs where id=$1", [
      chair.id,
    ]);
    expect(direct.rows[0].occupied_at).toBeNull();
  });

  it("keeps one physical table and its attached QR, and blocks archiving it", async () => {
    const a = await attachExistingTableQr(actor, outletId, tableId);
    const b = await attachExistingTableQr(actor, outletId, tableId);
    expect(b).toEqual(a);
    expect(a.tableId).toBe(tableId);
    expect(
      (await getFloorOverview(actor, outletId)).tables.find((t) => t.id === tableId)!.qrCode
    ).toMatchObject({
      destinationToken: a.token,
    });
    await expect(archiveTable(actor, outletId, tableId)).rejects.toThrow(
      /orders, bookings or a QR code/i
    );
  });

  it("rejects overlapping reservations and invalid lifecycle transitions", async () => {
    const start = new Date(Date.now() + 3 * 86400000).toISOString();
    const reservation = await createReservation(actor, outletId, {
      tableId,
      guestName: "Guest One",
      partySize: 2,
      reservationTime: start,
      durationMinutes: 90,
    });
    expect(reservation.status).toBe("confirmed");
    await expect(
      createReservation(actor, outletId, {
        tableId,
        guestName: "Guest Two",
        partySize: 2,
        reservationTime: new Date(Date.parse(start) + 30 * 60000).toISOString(),
        durationMinutes: 90,
      })
    ).rejects.toThrow(/already booked/i);
    await expect(
      createReservation(actor, outletId, {
        tableId,
        guestName: "Over capacity",
        partySize: 8,
        reservationTime: start,
        durationMinutes: 90,
      })
    ).rejects.toThrow(/seating capacity/i);
    await updateReservationStatus(actor, outletId, reservation.id, "seated");
    await updateReservationStatus(actor, outletId, reservation.id, "completed");
    await expect(
      updateReservationStatus(actor, outletId, reservation.id, "confirmed")
    ).rejects.toThrow(/cannot move/i);

    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(start));
    const dateParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(start));
    const value = (field: string) => dateParts.find((part) => part.type === field)?.value ?? "";
    const localDate = `${value("year")}-${value("month")}-${value("day")}`;
    expect(day).toBeTruthy();
    expect(
      (await getReservations(actor, outletId, localDate)).some((r) => r.id === reservation.id)
    ).toBe(true);
  });

  it("keeps live table signals optional, outlet-scoped and permission-guarded", async () => {
    // Default: off, no journey computed.
    let overview = await getFloorOverview(actor, outletId);
    expect(overview.signalSettings?.enabled ?? false).toBe(false);
    expect(overview.tables.every((t) => !t.journey)).toBe(true);

    // A stranger cannot switch it on for this outlet.
    await expect(updateSignalSettings(stranger, outletId, { enabled: true })).rejects.toThrow();

    const settings = await updateSignalSettings(actor, outletId, { enabled: true });
    expect(settings).toMatchObject({ enabled: true, showKitchen: true });
    overview = await getFloorOverview(actor, outletId);
    expect(overview.tables.every((t) => t.journey && t.journey.steps.length > 0)).toBe(true);

    // Turning one source off hides just that indicator.
    await updateSignalSettings(actor, outletId, { guestWaterButton: false });
    overview = await getFloorOverview(actor, outletId);
    expect(overview.tables[0]!.journey!.steps.some((s) => s.key === "water")).toBe(false);

    // The other outlet is untouched.
    const other = await getFloorOverview(stranger, strangerOutletId);
    expect(other.signalSettings?.enabled ?? false).toBe(false);

    await updateSignalSettings(actor, outletId, { enabled: false });
    overview = await getFloorOverview(actor, outletId);
    expect(overview.tables.every((t) => !t.journey)).toBe(true);
  });
});
