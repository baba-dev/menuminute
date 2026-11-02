// Read-only audit: which outlets are over (or at) the approved plan caps today.
// Run BEFORE enabling PLAN_LIMITS_ENFORCED. Operator-run with the isolated migration-owner URL
// (never web/worker credentials). Opens one READ ONLY transaction, writes nothing, and prints
// outlet/organization ids and counts only: no emails, names, prices or credentials.
//   MIGRATION_DATABASE_URL=... pnpm exec tsx scripts/plan-cap-audit.ts [--json]
import { Pool } from "pg";
import { buildCapAudit, type AuditRow } from "../src/modules/plans/audit";

const url = process.env["MIGRATION_DATABASE_URL"];
if (!url) throw new Error("Explicit migration connection required");
const json = process.argv.includes("--json");

// Counting rules mirror src/modules/plans/store.ts (dishes: distinct ids across live menus an
// outlet owns or is assigned; QR codes: active). The migration owner bypasses RLS, so these are
// the authoritative totals rather than a staff member's visibility.
const QUERY = `
with dish_counts as (
  select o.id as outlet_id, count(distinct item->>'id')::int as dishes
  from restaurants o
  join menus m on not m.archived
   and (m.outlet_id = o.id or exists (select 1 from menu_assignments a
                                      where a.menu_id = m.id and a.outlet_id = o.id))
  cross join lateral jsonb_array_elements(coalesce(m.document->'categories','[]'::jsonb)) c
  cross join lateral jsonb_array_elements(coalesce(c->'items','[]'::jsonb)) item
  where item ? 'id'
  group by o.id
), qr_counts as (
  select restaurant_id as outlet_id, count(*)::int as qr_codes
  from qr_codes where is_active group by restaurant_id
), table_counts as (
  select restaurant_id as outlet_id, count(*)::int as tables
  from restaurant_tables where is_active and display_number is not null group by restaurant_id
), chair_counts as (
  select outlet_id, count(*)::int as chairs
  from restaurant_chairs where is_active group by outlet_id
)
select r.id as "outletId", r.organization_id as "organizationId", r.slug,
       r.is_demo_data as demo,
       app_private.entitlement_allowed(r.organization_id,'ordering.new') as ordering,
       app_private.entitlement_allowed(r.organization_id,'kitchen.new') as kitchen,
       app_private.is_community_edition() as community,
       coalesce(d.dishes,0) as dishes, coalesce(q.qr_codes,0) as "qrCodes",
       coalesce(t.tables,0) as tables, coalesce(c.chairs,0) as chairs,
       (select count(*)::int from restaurants x where x.is_active and x.organization_id=r.organization_id) as outlets
from restaurants r
left join dish_counts d on d.outlet_id = r.id
left join qr_counts q on q.outlet_id = r.id
left join table_counts t on t.outlet_id = r.id
left join chair_counts c on c.outlet_id = r.id
order by r.id`;

async function main() {
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const { rows } = await client.query<AuditRow>(QUERY);
    await client.query("ROLLBACK");
    const audit = buildCapAudit(rows);
    if (json) {
      console.log(JSON.stringify({ summary: audit.summary, over: audit.over }, null, 2));
      return;
    }
    const s = audit.summary;
    console.log(
      `Outlets: ${s.outlets} | free ${s.byPlan.free}, ordering ${s.byPlan.ordering}, ` +
        `kitchen_pro ${s.byPlan.kitchen_pro}, uncapped ${s.byPlan.dedicated}`
    );
    console.log(`Over a cap now: ${s.overCount} | at or over a cap: ${s.atCapCount}`);
    for (const e of audit.over)
      console.log(
        [
          e.outletId,
          `org=${e.organizationId}`,
          `slug=${e.slug}`,
          `plan=${e.plan}`,
          `dishes=${e.dishes}/${e.dishCap}`,
          `qr=${e.qrCodes}/${e.qrCap}`,
          `tables=${e.tables}/${e.tablesCap}`,
          `chairs=${e.chairs}/${e.chairsCap}`,
          `outlets=${e.outlets}/${e.outletsCap}`,
          e.demo ? "demo" : "",
        ]
          .filter(Boolean)
          .join("  ")
      );
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error("Plan cap audit failed:", e instanceof Error ? e.message : "unknown");
  process.exitCode = 1;
});
