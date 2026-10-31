import type { PoolClient } from "pg";
import { generateMenuQrCode } from "@/modules/qr/service";
import { buildDemoBaseline, DEMO_IDS } from "./baseline";

/** Idempotent. Needs the migration-owner connection; call only from operator scripts and tests. */
export async function provisionDemo(c: PoolClient): Promise<Record<string, number>> {
  const qr = await generateMenuQrCode(DEMO_IDS.publicId);
  await c.query("begin");
  try {
    await c.query("select pg_advisory_xact_lock(60312103)");
    // No usable password: demo sessions are minted server-side by the entry route, never by login.
    await c.query(
      `insert into users(id,name,email,is_demo_data,email_verified) values($1,'Demo Owner',$2,true,true)
       on conflict (id) do nothing`,
      [DEMO_IDS.userId, DEMO_IDS.userEmail]
    );
    await c.query("select set_config('app.actor_id',$1,true)", [DEMO_IDS.userId]);
    await c.query("select app_private.provision_organization($1,$2,$3::jsonb)", [
      DEMO_IDS.outletId,
      DEMO_IDS.publicId,
      JSON.stringify({
        name: "Spice Route Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "restaurant",
        fulfillmentModes: ["dine_in", "pickup"],
        svgData: qr.svgData,
      }),
    ]);
    await c.query(
      "update restaurants set is_demo_data=true,is_published=true,city='Demonstration' where id=$1",
      [DEMO_IDS.outletId]
    );
    await c.query("commit");
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  }
  const { rows } = await c.query("select app_private.reset_demo_outlet($1::jsonb) as s", [
    JSON.stringify(buildDemoBaseline()),
  ]);
  return rows[0].s;
}
