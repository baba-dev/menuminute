import type { PoolClient } from "pg";
import { generateMenuQrCode } from "@/modules/qr/service";
import { buildDemoBaseline, DEMO_IDS } from "./baseline";

/** Idempotent. Needs the migration-owner connection; call only from operator scripts and tests. */
export async function provisionDemo(
  c: PoolClient,
  passwordHash?: string
): Promise<Record<string, number>> {
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
    if (passwordHash)
      await c.query(
        `insert into accounts(id,user_id,provider_id,account_id,password) values('demo-credential',$1,'credential',$1,$2)
         on conflict (id) do update set password=excluded.password`,
        [DEMO_IDS.userId, passwordHash]
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
  const baseline = JSON.stringify(buildDemoBaseline());
  // 1) publish the menu, 2) route every dish and grant Ordering/Kitchen (demo-only function),
  // 3) reset again so seeded live orders fan out to the now-enabled kitchen.
  await c.query("select app_private.reset_demo_outlet($1::jsonb)", [baseline]);
  await c.query("select app_private.provision_demo_ops()");
  const { rows } = await c.query("select app_private.reset_demo_outlet($1::jsonb) as s", [
    JSON.stringify(buildDemoBaseline()),
  ]);
  return rows[0].s;
}
