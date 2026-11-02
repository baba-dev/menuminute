import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  attachExistingTableQr,
  createTable,
  getFloorOverview,
  updateSignalSettings,
} from "../src/modules/hospitality/floor-service";
import {
  requestTableWater,
  staffServiceRequestAction,
  staffServiceRequests,
  tableServiceState,
} from "../src/modules/hospitality/service";

const ownerUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: ownerUrl, max: 2 });
const suffix = crypto.randomUUID().slice(0, 8);
const userId = `water-user-${suffix}`;
const outletId = `water-outlet-${suffix}`;
const actor = { userId };
let tableId = "";
let orgCache = "";
const orgId = () => orgCache;

let token = "";

async function provision() {
  const c = await owner.connect();
  try {
    await c.query("begin");
    await c.query("insert into users(id,name,email,email_verified) values($1,'Water QA',$2,true)", [
      userId,
      `${userId}@example.test`,
    ]);
    await c.query("select set_config('app.actor_id',$1,true)", [userId]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outletId,
      `water-${suffix}`,
      JSON.stringify({
        name: "Water QA",
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
const kinds = async () =>
  (
    await owner.query<{ kind: string }>(
      "select kind from table_signal_events where outlet_id=$1 and table_id=$2 and kind like 'water_%' order by occurred_at, id",
      [outletId, tableId]
    )
  ).rows.map((r) => r.kind);
const journeyOf = async () =>
  (await getFloorOverview(actor, outletId)).tables.find((t) => t.id === tableId)!.journey!;

describe("guest water button against real PostgreSQL", () => {
  beforeAll(async () => {
    await provision();
    orgCache = (
      await owner.query<{ organization_id: string }>(
        "select organization_id from restaurants where id=$1",
        [outletId]
      )
    ).rows[0]!.organization_id;
    tableId = (
      await createTable(actor, outletId, {
        name: "Water Table",
        sectionId: null,
        shape: "round",
        chairCount: 2,
        chairKind: "standard",
      })
    ).id;
    token = (await attachExistingTableQr(actor, outletId, tableId)).token;
  }, 60000);
  afterAll(async () => {
    await owner.end();
  });

  it("is unavailable until the outlet opts in", async () => {
    expect(await tableServiceState({ token })).toEqual({ water: false, request: null });
    await expect(requestTableWater({ token })).rejects.toThrow();
    expect(await kinds()).toEqual([]);
  });

  it("takes one request, debounces taps and records the staff steps", async () => {
    await updateSignalSettings(actor, outletId, { enabled: true });
    expect((await tableServiceState({ token })).water).toBe(true);

    expect(await requestTableWater({ token })).toMatchObject({
      status: "requested",
      debounced: false,
    });
    expect(await requestTableWater({ token })).toMatchObject({ debounced: true });
    expect(await kinds()).toEqual(["water_requested"]);

    // Order-less requests reach the staff queue and the floor card.
    const queue = await staffServiceRequests(actor, orgId(), outletId);
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ signal: "water_refill", orderNumber: null });
    let journey = await journeyOf();
    expect(journey.needsStaff).toBe(true);
    expect(journey.waterAction).toMatchObject({ action: "acknowledge", requestId: queue[0]!.id });

    await staffServiceRequestAction(actor, orgId(), outletId, {
      requestId: queue[0]!.id,
      action: "acknowledge",
    });
    expect((await tableServiceState({ token })).request?.status).toBe("acknowledged");
    journey = await journeyOf();
    expect(journey.waterAction).toMatchObject({ action: "resolve" });

    await staffServiceRequestAction(actor, orgId(), outletId, {
      requestId: queue[0]!.id,
      action: "resolve",
    });
    expect(await kinds()).toEqual(["water_requested", "water_acknowledged", "water_served"]);
    journey = await journeyOf();
    expect(journey.needsStaff).toBe(false);
    expect(journey.steps.find((s) => s.key === "water")!.state).toBe("done");
  });

  it("allows a new request once the last one is resolved and a minute old", async () => {
    expect(await requestTableWater({ token })).toMatchObject({ debounced: true });
    await owner.query(
      "update guest_service_requests set requested_at=requested_at-interval '5 minutes' where outlet_id=$1",
      [outletId]
    );
    expect(await requestTableWater({ token })).toMatchObject({ debounced: false });
  });

  it("honours the water sub-toggle and ignores menu-only QR codes", async () => {
    await updateSignalSettings(actor, outletId, { guestWaterButton: false });
    expect((await tableServiceState({ token })).water).toBe(false);
    await expect(requestTableWater({ token })).rejects.toThrow();
    await updateSignalSettings(actor, outletId, { guestWaterButton: true });
    const menuToken = `menu-only-${suffix}-token`;
    await owner.query(
      "insert into qr_codes(id,restaurant_id,purpose,label,destination_token) values($1,$2,'menu','Menu',$3)",
      [`qr-menu-${suffix}`, outletId, menuToken]
    );
    expect(await tableServiceState({ token: menuToken })).toEqual({ water: false, request: null });
    await expect(requestTableWater({ token: menuToken })).rejects.toThrow();
    await expect(requestTableWater({ token: "short" })).rejects.toThrow();
  });
});
