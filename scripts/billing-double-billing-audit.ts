// Read-only audit: organizations that appear to be billed for BOTH Ordering and Kitchen Pro.
// Kitchen Pro includes ordering, so any listed Ordering subscription should be cancelled (the webhook now
// does this automatically for new Kitchen Pro payments; this finds ones created before that fix).
// Operator-run with the isolated migration-owner URL; one READ ONLY transaction; prints subscription ids
// and organization ids only. Cancel at the provider, then the next Kitchen charge or this audit confirms.
//   MIGRATION_DATABASE_URL=... pnpm exec tsx scripts/billing-double-billing-audit.ts
import { Pool } from "pg";

const url = process.env["MIGRATION_DATABASE_URL"];
if (!url) throw new Error("Explicit migration connection required");

const QUERY = `
select o.organization_id as "organizationId", o.subscription_id as "orderingSubscription",
       k.subscription_id as "kitchenSubscription", o.status as "orderingStatus", o.current_end as "orderingPeriodEnd"
from app_private.razorpay_subscriptions o
join app_private.razorpay_subscriptions k
  on k.organization_id = o.organization_id and k.product_key = 'kitchen_pro'
 and k.status in ('active','authenticated','pending')
 and exists (select 1 from app_private.razorpay_charges c where c.subscription_id = k.subscription_id)
where o.product_key = 'ordering' and o.status in ('active','authenticated','pending')
  and o.cancel_requested_at is null
order by o.created_at`;

async function main() {
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query(QUERY);
    await client.query("ROLLBACK");
    console.log(`Organizations billed for both plans: ${rows.length}`);
    for (const r of rows)
      console.log(
        `${r.organizationId}  ordering=${r.orderingSubscription} (${r.orderingStatus}, period ends ${r.orderingPeriodEnd?.toISOString?.() ?? "n/a"})  kitchen=${r.kitchenSubscription}`
      );
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error("Double-billing audit failed:", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
});
