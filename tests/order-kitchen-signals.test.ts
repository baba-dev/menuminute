import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  createTable,
  getFloorOverview,
  updateSignalSettings,
} from "../src/modules/hospitality/floor-service";

const ownerUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: ownerUrl, max: 2 });
const suffix = crypto.randomUUID().slice(0, 8);
const userId = `order-sig-user-${suffix}`;
const outletId = `order-sig-outlet-${suffix}`;
const actor = { userId };
let tableId = "";

async function provision() {
  const c = await owner.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into users(id,name,email,email_verified) values($1,'Order Signals QA',$2,true)",
      [userId, `${userId}@example.test`]
    );
    await c.query("select set_config('app.actor_id',$1,true)", [userId]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outletId,
      `order-sig-${suffix}`,
      JSON.stringify({
        name: "Order Signals QA",
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
      "select kind from table_signal_events where outlet_id=$1 and table_id=$2 and ref_id=$3 order by occurred_at, id",
      [outletId, tableId, orderId]
    )
  ).rows.map((r) => r.kind);
const journeyOf = async () =>
  (await getFloorOverview(actor, outletId)).tables.find((t) => t.id === tableId)!.journey!;
const stateOf = (j: Awaited<ReturnType<typeof journeyOf>>, key: string) =>
  j.steps.find((s) => s.key === key)!;
let orderId = "";
let seq = 0;
async function move(to: string, at: string) {
  await owner.query("update orders set status=$2 where id=$1", [orderId, to]);
  await owner.query(
    `insert into order_status_events(id,order_id,restaurant_id,from_status,to_status,status,actor_type,created_at)
     values($1,$2,$3,null,$4,$4,'staff',$5)`,
    [`ose-${suffix}-${seq++}`, orderId, outletId, to, at]
  );
}

describe("order, kitchen and payment signals against real PostgreSQL", () => {
  beforeAll(async () => {
    await provision();
    tableId = (
      await createTable(actor, outletId, {
        name: "Signal Table",
        sectionId: null,
        shape: "round",
        chairCount: 2,
        chairKind: "standard",
      })
    ).id;
    orderId = `ord-${suffix}`;
    await owner.query(
      `insert into orders(id,restaurant_id,table_id,tracking_token,order_number,status,fulfillment_mode,
         payment_status,currency,total_minor)
       values($1,$2,$3,$4,1,'pending','dine_in','unpaid','INR',10000)`,
      [orderId, outletId, tableId, `trk-${suffix}-0000`]
    );
  }, 60000);
  afterAll(async () => {
    await owner.end();
  });

  it("records nothing while the outlet has not opted in", async () => {
    await move("pending", new Date(Date.now() - 600_000).toISOString());
    expect(await kinds()).toEqual([]);
  });

  it("records the order lifecycle with the real status times once opted in", async () => {
    await updateSignalSettings(actor, outletId, { enabled: true });
    const at = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    await move("pending", at(9));
    await move("accepted", at(8));
    await move("preparing", at(6));
    await move("ready", at(3));
    await move("served", at(1));
    expect(await kinds()).toEqual([
      "order_placed",
      "order_accepted",
      "kitchen_preparing",
      "kitchen_ready",
      "order_served",
    ]);
    const journey = await journeyOf();
    const ready = stateOf(journey, "ready");
    expect(ready.state).toBe("done");
    // The step time is the recorded status time (about 3 minutes ago), not the order's last update.
    expect(Math.abs(Date.now() - new Date(ready.at!).getTime() - 3 * 60_000)).toBeLessThan(10_000);
    expect(stateOf(journey, "delivered").state).toBe("done");
  });

  it("is idempotent for a repeated status", async () => {
    await move("served", new Date().toISOString());
    expect((await kinds()).filter((k) => k === "order_served")).toHaveLength(1);
  });

  it("records payment, once, only for a paid order", async () => {
    expect(stateOf(await journeyOf(), "paid").state).toBe("idle");
    await owner.query("update orders set payment_status='paid' where id=$1", [orderId]);
    await owner.query("update orders set payment_status='paid', notes='x' where id=$1", [orderId]);
    expect((await kinds()).filter((k) => k === "paid")).toHaveLength(1);
    expect(stateOf(await journeyOf(), "paid").state).toBe("done");
  });

  it("honours the kitchen sub-toggle and skips orders with no table", async () => {
    await updateSignalSettings(actor, outletId, { showKitchen: false });
    const second = `ord2-${suffix}`;
    await owner.query(
      `insert into orders(id,restaurant_id,table_id,tracking_token,order_number,status,fulfillment_mode,
         payment_status,currency,total_minor)
       values($1,$2,$3,$4,2,'pending','dine_in','unpaid','INR',5000)`,
      [second, outletId, tableId, `trk-${suffix}-0002`]
    );
    for (const to of ["pending", "preparing", "ready"])
      await owner.query(
        `insert into order_status_events(id,order_id,restaurant_id,to_status,status,actor_type)
         values($1,$2,$3,$4,$4,'staff')`,
        [`ose2-${suffix}-${to}`, second, outletId, to]
      );
    const rows = await owner.query<{ kind: string }>(
      "select kind from table_signal_events where ref_id=$1",
      [second]
    );
    expect(rows.rows.map((r) => r.kind)).toEqual(["order_placed"]);

    const noTable = `ord3-${suffix}`;
    await owner.query(
      `insert into orders(id,restaurant_id,table_id,tracking_token,order_number,status,fulfillment_mode,
         payment_status,currency,total_minor)
       values($1,$2,null,$3,3,'pending','takeaway','unpaid','INR',5000)`,
      [noTable, outletId, `trk-${suffix}-0003`]
    );
    await owner.query(
      `insert into order_status_events(id,order_id,restaurant_id,to_status,status,actor_type)
       values($1,$2,$3,'pending','pending','guest')`,
      [`ose3-${suffix}`, noTable, outletId]
    );
    expect(
      (await owner.query("select 1 from table_signal_events where ref_id=$1", [noTable])).rowCount
    ).toBe(0);
  });
});
