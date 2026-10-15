import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { generateMenuQrCode } from "../src/modules/qr/service";
if (process.env["NODE_ENV"] === "production" || process.env["ALLOW_DEMO_SEED"] !== "true")
  throw new Error("Demo seed requires non-production and explicit ALLOW_DEMO_SEED=true");
if (!process.env["DEMO_PASSWORD"] || process.env["DEMO_PASSWORD"].length < 12)
  throw new Error("Set a unique DEMO_PASSWORD of at least 12 characters");
const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
async function seed() {
  if (!process.env["MIGRATION_DATABASE_URL"])
    throw new Error("Explicit migration connection required");
  const c = await pool.connect();
  try {
    const qr = await generateMenuQrCode("demo-spice-route-kitchen-v1");
    const password = await hashPassword(process.env["DEMO_PASSWORD"]!);
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(60312102)");
    if (
      (await c.query("select id from restaurants where public_id='demo-spice-route-kitchen-v1'"))
        .rowCount
    ) {
      await c.query("commit");
      return;
    }
    await c.query(
      "insert into users(id,name,email,is_demo_data) values('demo-owner','Demo Owner','demo@menuminute.com',true)"
    );
    await c.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values('demo-credential','demo-owner','credential','demo-owner',$1)",
      [password]
    );
    await c.query("select set_config('app.actor_id','demo-owner',true)");
    await c.query(
      "select app_private.provision_organization('demo-outlet','demo-spice-route-kitchen-v1',$1::jsonb)",
      [
        JSON.stringify({
          name: "Spice Route Kitchen",
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
          svgData: qr.svgData,
        }),
      ]
    );
    await c.query(
      "update restaurants set is_demo_data=true,is_published=true,city='Demonstration' where id='demo-outlet'"
    );
    await c.query(
      "insert into menu_categories(id,restaurant_id,name) values('demo-category','demo-outlet','Sample dishes')"
    );
    await c.query(
      "insert into menu_items(id,restaurant_id,category_id,name,price_paise,is_demo_data) values('demo-dish','demo-outlet','demo-category','Paneer Tikka',29900,true)"
    );
    await c.query("commit");
    console.warn("Demo seed complete");
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
seed().catch(() => {
  console.error("Demo seed failed; inspect isolated development configuration");
  process.exitCode = 1;
});
