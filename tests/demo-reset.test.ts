import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { provisionDemo } from "../src/modules/demo/provision";
import { clearDemoConsumerReceipts } from "./helpers/demo-receipts";
import { buildDemoBaseline, DEMO_IDS } from "../src/modules/demo/baseline";
import { resetDemoOutlet } from "../src/modules/demo/reset";
import { claimEvents, consumeEvent } from "../src/modules/jobs/worker";

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
  crm_guests:
    "public demo does not store guest mobile identities; production records are tenant-scoped",
  crm_erased_phones: "public demo does not store guest profiles or retention suppression",
  crm_guest_orders: "automatically deleted with demo orders through ON DELETE CASCADE",
  guest_devices:
    "never written for the demo outlet (guest_device_remember refuses is_demo_data, migration 0101)",
  dish_reviews:
    "never written for the demo outlet (guest_review_submit refuses is_demo_data, migration 0103)",
  dish_rating_aggregates:
    "only written together with dish_reviews, which the demo outlet never has",
  account_workspace_preferences: "user preference",
  account_deletion_requests:
    "personal privacy requests are blocked for demo outlets and not an outlet reset concern",
  ai_usage_records: "spend accounting",
  assistant_action_requests: "removed with its conversation by ON DELETE CASCADE (migration 0065)",
  assistant_model_daily_budget: "spend accounting",
  support_tickets: "never written for the demo outlet (blocked in support_create_ticket)",
  assistant_org_daily_budget: "spend accounting",
  audit_logs: "audit trail",
  brand_outlets: "tenant structure",
  brands: "tenant structure",
  dining_floor_plans: "legacy floor layout configuration (no longer read)",
  dining_sections: "floor configuration; the demo section is re-asserted when tables are restored",
  restaurant_chairs:
    "removed with their table by ON DELETE CASCADE; trigger restaurant_tables_demo_seed re-seeds them (migration 0073)",
  floor_signal_settings:
    "configuration (optional live table signals; default off, migration 0090); the demo outlet's is switched on by seed_demo_signals",
  table_signal_events:
    "ephemeral telemetry ledger pruned after 48 hours; app_private.seed_demo_signals (0096) clears and re-seeds the demo outlet's after each reset",
  dining_reservations: "reservations ledger",
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
  pwa_push_deliveries:
    "push is blocked for the demo actor (guard denies /api/pwa/push); stays empty",
  pwa_push_subscriptions:
    "push is blocked for the demo actor (guard denies /api/pwa/push); stays empty",
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
      await clearDemoConsumerReceipts(c);
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
      (await owner.query("select count(*)::int n from orders where id='demo-order-1'")).rows[0].n
    ).toBe(0); // the visitor order is gone; the seeded history is restored (see demo-orders.test.ts)
    const tables = await owner.query(
      "select count(*)::int n, bool_or(label='Visitor edit') edited from restaurant_tables where restaurant_id=$1",
      [DEMO_IDS.outletId]
    );
    expect(tables.rows[0]).toEqual({ n: 12, edited: false });
    // The floor is rebuilt with sections, numbers and chairs, and visitor occupancy is wiped.
    const floor = await owner.query(
      `select count(*)::int tables, count(*) filter (where display_number is not null)::int numbered,
         count(*) filter (where section_id is not null)::int sectioned,
         (select count(*)::int from restaurant_chairs c where c.outlet_id=$1) chairs,
         (select count(*)::int from restaurant_chairs c where c.outlet_id=$1 and c.occupied_at is not null) occupied,
         (select coalesce(sum(capacity),0)::int from restaurant_tables where restaurant_id=$1) capacity
       from restaurant_tables where restaurant_id=$1`,
      [DEMO_IDS.outletId]
    );
    expect(floor.rows[0]).toMatchObject({ tables: 12, numbered: 12, sectioned: 12, occupied: 0 });
    expect(floor.rows[0].chairs).toBeGreaterThan(0);
    expect(floor.rows[0].chairs).toBe(floor.rows[0].capacity);
  });

  it("seeds sample live table signals for the demo outlet only, replacing them on every reset", async () => {
    await resetDemoOutlet(worker);
    const settings = await owner.query(
      "select outlet_id from floor_signal_settings where enabled and outlet_id=$1",
      [DEMO_IDS.outletId]
    );
    expect(settings.rowCount).toBe(1);
    const kinds = async () =>
      (
        await owner.query<{ kind: string; n: number }>(
          "select kind, count(*)::int n from table_signal_events where outlet_id=$1 group by kind",
          [DEMO_IDS.outletId]
        )
      ).rows;
    const first = await kinds();
    expect(first.find((r) => r.kind === "qr_scanned")!.n).toBeGreaterThanOrEqual(1);
    expect(first.some((r) => r.kind === "water_requested")).toBe(true);
    expect(first.some((r) => r.kind === "bill_presented")).toBe(true);
    // A visitor-style leftover event disappears with the next reset.
    await owner.query(
      `insert into table_signal_events(id,outlet_id,table_id,kind,source,dedupe_key)
       values('visitor-signal',$1,'demo-table-4','qr_scanned','guest','visitor-signal')`,
      [DEMO_IDS.outletId]
    );
    await resetDemoOutlet(worker);
    expect(
      (await owner.query("select 1 from table_signal_events where id='visitor-signal'")).rowCount
    ).toBe(0);
    // Nothing is seeded for any other outlet, and the function is not callable by the app role.
    expect(
      (
        await owner.query(
          "select 1 from table_signal_events where outlet_id<>$1 and dedupe_key like 'demo:%'",
          [DEMO_IDS.outletId]
        )
      ).rowCount
    ).toBe(0);
    await expect(app.query("select app_private.seed_demo_signals()")).rejects.toThrow();
  });

  it("is deterministic and keeps the revision stable unless a visitor edited the menu", async () => {
    const before = (
      await owner.query("select revision, document from menus where id=$1", [DEMO_IDS.menuId])
    ).rows[0];
    await resetDemoOutlet(worker);
    const after = (
      await owner.query("select revision, document from menus where id=$1", [DEMO_IDS.menuId])
    ).rows[0];
    expect(after.revision).toBe(before.revision); // untouched menu: no needless cache-busting bump
    expect(after.document).toEqual(JSON.parse(JSON.stringify(buildDemoBaseline().menu)));

    // A visitor edit (new revision, republished) is reverted at a strictly higher revision.
    await owner.query(
      `update menus set document=jsonb_set(document,'{name}','"Hacked"'), revision=revision+1, published_revision=revision+1 where id=$1`,
      [DEMO_IDS.menuId]
    );
    const edited = (await owner.query("select revision from menus where id=$1", [DEMO_IDS.menuId]))
      .rows[0];
    await resetDemoOutlet(worker);
    const reverted = (
      await owner.query("select revision, document->>'name' as name from menus where id=$1", [
        DEMO_IDS.menuId,
      ])
    ).rows[0];
    expect(reverted.name).toBe("Spice Route Kitchen");
    expect(reverted.revision).toBe(edited.revision + 1);
    expect(
      (
        await owner.query("select count(*)::int n from menu_releases where menu_id=$1", [
          DEMO_IDS.menuId,
        ])
      ).rows[0].n
    ).toBe(1);
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

  it("resets after the worker consumed demo events and keeps other tenants' receipts", async () => {
    // Seeded live orders fan out kitchen events; the production worker consumes them like any other.
    await resetDemoOutlet(worker);
    const real = await owner.query<{ id: string; organization_id: string }>(
      "select id, organization_id from outbox_events where organization_id='org-real-outlet' limit 1"
    );
    expect(real.rowCount).toBe(1);
    await owner.query(
      "insert into consumer_receipts(event_id,consumer,organization_id) values($1,'sentinel-v1',$2) on conflict do nothing",
      [real.rows[0]!.id, real.rows[0]!.organization_id]
    );
    // Drain every claimable event (other test files may share this database) through the real consumer.
    for (let i = 0; i < 20; i++) {
      const batch = await claimEvents(worker, 50);
      if (batch.length === 0) break;
      for (const e of batch)
        await consumeEvent(
          worker,
          {
            eventId: e.id,
            organizationId: e.organization_id,
            attempt: e.attempts,
            deliverySequence: e.delivery_sequence,
            schemaVersion: 1,
          },
          `${e.id}-${e.delivery_sequence}`
        ).catch(() => undefined);
    }
    const receipts = () =>
      owner.query<{ n: number }>(
        "select count(*)::int n from consumer_receipts where organization_id=$1",
        [DEMO_IDS.organizationId]
      );
    expect((await receipts()).rows[0]!.n).toBeGreaterThan(0); // precondition: receipts reference demo events
    await expect(resetDemoOutlet(worker)).resolves.toBeDefined(); // used to fail with FK 23503
    expect((await receipts()).rows[0]!.n).toBe(0);
    expect(
      (
        await owner.query(
          "select count(*)::int n from consumer_receipts where consumer='sentinel-v1'"
        )
      ).rows[0].n
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
    // Added after 0059: the receipts of the deleted demo events (FK to outbox_events), migration 0077.
    const resetSince0077 = ["consumer_receipts"];
    const { rows } = await owner.query<{ t: string }>(
      `select distinct table_name t from information_schema.columns
       where table_schema='public' and column_name in ('restaurant_id','outlet_id','organization_id')`
    );
    const unaccounted = rows
      .map((r) => r.t)
      .filter((t) => !reset.has(t) && !resetSince0077.includes(t) && !(t in PRESERVED));
    expect(unaccounted, "new scoped table: add it to the reset function or PRESERVED").toEqual([]);
    const migration = (await import("node:fs")).readFileSync(
      "src/db/migrations/0059_demo_outlet_reset.sql",
      "utf8"
    );
    for (const t of reset)
      expect(migration, t).toMatch(new RegExp(`(DELETE FROM|INSERT INTO) ${t}\\b`));
    const latest = (await import("node:fs")).readFileSync(
      "src/db/migrations/0077_demo_reset_consumer_receipts.sql",
      "utf8"
    );
    for (const t of resetSince0077) expect(latest, t).toMatch(new RegExp(`DELETE FROM ${t}\\b`));
  });
});
