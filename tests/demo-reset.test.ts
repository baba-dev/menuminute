import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { provisionDemo } from "../src/modules/demo/provision";
import { buildDemoBaseline, DEMO_IDS } from "../src/modules/demo/baseline";
import { resetDemoOutlet } from "../src/modules/demo/reset";

const ownerUrl = process.env["MIGRATION_DATABASE_URL"]!;
const owner = new Pool({ connectionString: ownerUrl, max: 2 });
const asRole = (user: string, pass: string) => {
  const u = new URL(ownerUrl);
  u.username = user;
  u.password = pass;
  return new Pool({ connectionString: u.toString(), max: 1 });
};
const worker = asRole("menuminute_worker", "isolated-ci-worker-password");
const app = asRole("menuminute_app", "isolated-ci-app-password");

// Tables carrying outlet/org scope that the reset intentionally leaves alone, with the reason.
const PRESERVED: Record<string, string> = {
  account_workspace_preferences: "user preference",
  ai_usage_records: "spend accounting",
  assistant_model_daily_budget: "spend accounting",
  assistant_org_daily_budget: "spend accounting",
  audit_logs: "audit trail",
  brand_outlets: "tenant structure",
  brands: "tenant structure",
  consumer_receipts: "worker idempotency",
  domain_audit: "audit trail",
  domain_projections: "projection",
  entitlement_grants: "demo entitlements",
  kitchen_event_counters: "monotonic counter",
  kitchen_outlet_settings: "configuration",
  kitchen_pilot_outlets: "configuration",
  kitchen_routes: "configuration",
  kitchen_station_members: "configuration",
  kitchen_stations: "configuration",
  media_assets: "uploads disabled for demo; files are operator-managed",
  menu_assignments: "tenant structure",
  menu_categories: "legacy menu tables unused by the versioned demo",
  menu_item_variants: "legacy menu tables unused by the versioned demo",
  menu_items: "legacy menu tables unused by the versioned demo",
  menu_media: "legacy menu tables unused by the versioned demo",
  menus: "restored in place",
  onboarding_progress: "user preference",
  order_counters: "monotonic counter",
  organization_members: "demo team (managed by provisioning)",
  outlet_grants: "demo team (managed by provisioning)",
  provisioning_requests: "provisioning idempotency",
  qr_codes: "tenant structure",
  razorpay_checkout_intents: "billing is blocked for the demo org",
  razorpay_subscriptions: "billing is blocked for the demo org",
  restaurant_subscriptions: "billing",
  restaurants: "restored in place",
  // POS ledger rows are immutable by design: the demo outlet never enables POS.
  pos_bills: "immutable POS ledger",
  pos_cash_movements: "immutable POS ledger",
  pos_commands: "immutable POS ledger",
  pos_credit_groups: "immutable POS ledger",
  pos_credit_lines: "immutable POS ledger",
  pos_document_deliveries: "immutable POS ledger",
  pos_document_sequences: "immutable POS ledger",
  pos_documents: "immutable POS ledger",
  pos_finance_commands: "immutable POS ledger",
  pos_finance_gates: "immutable POS ledger",
  pos_outlet_settings: "immutable POS ledger",
  pos_provider_attempts: "immutable POS ledger",
  pos_refunds: "immutable POS ledger",
  pos_sale_lines: "immutable POS ledger",
  pos_sales: "immutable POS ledger",
  pos_seller_profiles: "immutable POS ledger",
  pos_shifts: "immutable POS ledger",
  pos_staff_payment_attestations: "immutable POS ledger",
  pos_staff_refunds: "immutable POS ledger",
  pos_tax_classes: "immutable POS ledger",
  pos_tax_profiles: "immutable POS ledger",
  pos_tenders: "immutable POS ledger",
};

async function seedRuntimeRows() {
  const o = DEMO_IDS.outletId;
  await owner.query(
    `insert into orders(id,restaurant_id,table_id,status,order_number,customer_name) values('demo-order-1',$1,'demo-table-1','pending',1,'Visitor')`,
    [o]
  );
  await owner.query(`update restaurant_tables set label='Visitor edit' where id='demo-table-2'`);
  await owner.query(`delete from restaurant_tables where id='demo-table-3'`);
}

describe("demo outlet reset", () => {
  beforeAll(async () => {
    const c = await owner.connect();
    try {
      await provisionDemo(c);
    } finally {
      c.release();
    }
    // An unrelated real tenant that must survive every reset untouched.
    await owner.query(
      `insert into users(id,name,email,email_verified) values('real-user','Real','real@example.test',true) on conflict do nothing`
    );
    const c2 = await owner.connect();
    try {
      await c2.query("begin");
      await c2.query("select set_config('app.actor_id','real-user',true)");
      await c2.query(
        `select app_private.provision_organization('real-outlet','real-outlet-public-1',$1::jsonb)`,
        [
          JSON.stringify({
            name: "Real Cafe",
            country: "IN",
            currency: "INR",
            timezone: "Asia/Kolkata",
            outletType: "restaurant",
            svgData: "<svg/>",
          }),
        ]
      );
      await c2.query("commit");
    } finally {
      c2.release();
    }
    await owner.query(
      `insert into orders(id,restaurant_id,status,order_number) values('real-order-1','real-outlet','pending',1) on conflict do nothing`
    );
  }, 60000);
  afterAll(async () => {
    await Promise.all([owner.end(), worker.end(), app.end()]);
  });

  it("restores all 236 dishes and removes visitor runtime state", async () => {
    await seedRuntimeRows();
    const summary = await resetDemoOutlet(worker);
    expect(summary["orders"]).toBeGreaterThanOrEqual(1);
    const menu = await owner.query(
      "select revision, published_revision, jsonb_path_query_array(document,'$.categories[*].items[*].id') as ids from menus where id=$1",
      [DEMO_IDS.menuId]
    );
    expect(menu.rows[0].ids).toHaveLength(236);
    expect(menu.rows[0].published_revision).toBe(menu.rows[0].revision);
    const release = await owner.query(
      "select count(*)::int n from menu_releases where menu_id=$1",
      [DEMO_IDS.menuId]
    );
    expect(release.rows[0].n).toBe(1);
    expect(
      (
        await owner.query("select count(*)::int n from orders where restaurant_id=$1", [
          DEMO_IDS.outletId,
        ])
      ).rows[0].n
    ).toBe(0);
    const tables = await owner.query(
      "select count(*)::int n, bool_or(label='Visitor edit') edited from restaurant_tables where restaurant_id=$1",
      [DEMO_IDS.outletId]
    );
    expect(tables.rows[0]).toEqual({ n: 12, edited: false });
  });

  it("is deterministic: a second reset yields the identical menu with a higher revision", async () => {
    const before = (
      await owner.query("select revision, document from menus where id=$1", [DEMO_IDS.menuId])
    ).rows[0];
    await resetDemoOutlet(worker);
    const after = (
      await owner.query("select revision, document from menus where id=$1", [DEMO_IDS.menuId])
    ).rows[0];
    expect(after.revision).toBe(before.revision + 1);
    expect(after.document).toEqual(before.document);
    expect(after.document).toEqual(JSON.parse(JSON.stringify(buildDemoBaseline().menu)));
  });

  it("never touches other tenants", async () => {
    await resetDemoOutlet(worker);
    const r = await owner.query("select count(*)::int n from orders where id='real-order-1'");
    expect(r.rows[0].n).toBe(1);
    expect(
      (await owner.query("select count(*)::int n from restaurants where id='real-outlet'")).rows[0]
        .n
    ).toBe(1);
  });

  it("is executable only by the worker role and refuses non-demo or malformed input", async () => {
    await expect(
      app.query("select app_private.reset_demo_outlet($1::jsonb)", ["{}"])
    ).rejects.toThrow(/permission denied/);
    await expect(
      worker.query("select app_private.reset_demo_outlet($1::jsonb)", ["{}"])
    ).rejects.toThrow(/Invalid demo baseline/);
    await owner.query("update restaurants set is_demo_data=false where id=$1", [DEMO_IDS.outletId]);
    try {
      await expect(resetDemoOutlet(worker)).rejects.toThrow(/not provisioned/);
    } finally {
      await owner.query("update restaurants set is_demo_data=true where id=$1", [
        DEMO_IDS.outletId,
      ]);
    }
  });

  it("accounts for every outlet- or organization-scoped table (reset or explicitly preserved)", async () => {
    const reset = new Set([
      "kitchen_work_history",
      "kitchen_work",
      "kitchen_command_receipts",
      "kitchen_events",
      "guest_service_requests",
      "order_status_events",
      "order_items",
      "orders",
      "assistant_attempts",
      "assistant_action_proposals",
      "assistant_turns",
      "assistant_conversations",
      "menu_import_ai_usage",
      "menu_import_candidates",
      "menu_import_reviews",
      "menu_import_sources",
      "menu_imports",
      "dish_media",
      "outbox_events",
      "domain_commands",
      "organization_invitations",
      "menu_overrides",
      "menu_translation_revisions",
      "menu_translations",
      "menu_releases",
      "restaurant_tables",
    ]);
    const { rows } = await owner.query<{ t: string }>(
      `select distinct table_name t from information_schema.columns
       where table_schema='public' and column_name in ('restaurant_id','outlet_id','organization_id')`
    );
    const unaccounted = rows.map((r) => r.t).filter((t) => !reset.has(t) && !(t in PRESERVED));
    expect(unaccounted, "new scoped table: add it to the reset function or PRESERVED").toEqual([]);
    const migration = (await import("node:fs")).readFileSync(
      "src/db/migrations/0057_demo_outlet_reset.sql",
      "utf8"
    );
    for (const t of reset)
      expect(migration, t).toMatch(new RegExp(`(DELETE FROM|INSERT INTO) ${t}\\b`));
  });
});
