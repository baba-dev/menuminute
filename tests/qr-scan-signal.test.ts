import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  attachExistingTableQr,
  createTable,
  getFloorOverview,
  updateSignalSettings,
} from "../src/modules/hospitality/floor-service";
import { recordQrScan } from "../src/modules/hospitality/service";

const ownerUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: ownerUrl, max: 2 });
const suffix = crypto.randomUUID().slice(0, 8);
const userId = `qr-scan-user-${suffix}`;
const outletId = `qr-scan-outlet-${suffix}`;
const actor = { userId };
let tableId = "";
let token = "";

async function provision() {
  const c = await owner.connect();
  try {
    await c.query("begin");
    await c.query(
      "insert into users(id,name,email,email_verified) values($1,'QR Scan QA',$2,true)",
      [userId, `${userId}@example.test`]
    );
    await c.query("select set_config('app.actor_id',$1,true)", [userId]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      outletId,
      `qr-scan-${suffix}`,
      JSON.stringify({
        name: "QR Scan QA",
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
const events = async () =>
  (
    await owner.query<{ kind: string }>(
      "select kind from table_signal_events where outlet_id=$1 and table_id=$2",
      [outletId, tableId]
    )
  ).rows;
const scanCount = async () =>
  (
    await owner.query<{ n: number }>(
      "select scan_count n from qr_codes where destination_token=$1",
      [token]
    )
  ).rows[0]!.n;

describe("QR scan ping against real PostgreSQL", () => {
  beforeAll(async () => {
    await provision();
    const table = await createTable(actor, outletId, {
      name: "Scan Table",
      sectionId: null,
      shape: "round",
      chairCount: 2,
      chairKind: "standard",
    });
    tableId = table.id;
    token = (await attachExistingTableQr(actor, outletId, tableId)).token;
  }, 60000);
  afterAll(async () => {
    await owner.end();
  });

  it("counts the scan but records no signal while the outlet has not opted in", async () => {
    expect(await recordQrScan({ token })).toEqual({ recorded: false });
    expect(await events()).toEqual([]);
    expect(await scanCount()).toBe(1);
  });

  it("records one scan per minute once opted in, and shows it on the floor", async () => {
    await updateSignalSettings(actor, outletId, { enabled: true });
    expect(await recordQrScan({ token })).toEqual({ recorded: true });
    expect(await recordQrScan({ token })).toEqual({ recorded: false }); // same minute
    expect(await events()).toEqual([{ kind: "qr_scanned" }]);
    const row = (await getFloorOverview(actor, outletId)).tables.find((t) => t.id === tableId)!;
    expect(row.journey!.steps.find((s) => s.key === "qr")!.state).toBe("done");
  });

  it("honours the QR-ping sub-toggle and ignores unknown or malformed tokens", async () => {
    await owner.query("delete from table_signal_events where outlet_id=$1", [outletId]);
    await updateSignalSettings(actor, outletId, { qrScanPings: false });
    expect(await recordQrScan({ token })).toEqual({ recorded: false });
    expect(await events()).toEqual([]);
    expect(await recordQrScan({ token: "x".repeat(40) })).toEqual({ recorded: false });
    await expect(recordQrScan({ token: "short" })).rejects.toThrow();
    await expect(recordQrScan({ token, extra: 1 })).rejects.toThrow();
  });

  it("does not record a menu-only QR that is not tied to a table", async () => {
    await updateSignalSettings(actor, outletId, { qrScanPings: true });
    const menuToken = `menu-only-${suffix}-token`;
    await owner.query(
      `insert into qr_codes(id,restaurant_id,purpose,label,destination_token)
       values($1,$2,'menu','Menu',$3)`,
      [`qr-menu-${suffix}`, outletId, menuToken]
    );
    expect(await recordQrScan({ token: menuToken })).toEqual({ recorded: false });
    expect(await events()).toEqual([]);
  });

  it("prunes signals older than 48 hours and nothing else", async () => {
    await owner.query(
      `insert into table_signal_events(id,outlet_id,table_id,kind,source,dedupe_key,occurred_at)
       values($1,$2,$3,'qr_scanned','guest','old-'||$1,now()-interval '49 hours'),
             ($4,$2,$3,'qr_scanned','guest','new-'||$4,now()-interval '1 hour')`,
      [`old-${suffix}`, outletId, tableId, `new-${suffix}`]
    );
    await owner.query("select app_private.prune_table_signals()");
    const left = await owner.query<{ id: string }>(
      "select id from table_signal_events where outlet_id=$1",
      [outletId]
    );
    expect(left.rows.map((r) => r.id)).toEqual([`new-${suffix}`]);
  });
});
