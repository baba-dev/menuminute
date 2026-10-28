import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";
/** Explicit offline cutover tool. Source is opened read-only; target must be empty. */
export async function importSqlite(
  source: string,
  targetUrl: string,
  acknowledgeSessionReset: boolean,
  timezones: Record<string, string>
) {
  if (!acknowledgeSessionReset) throw new Error("Explicit session reset acknowledgement required");
  const sourceDb = new Database(source, { readonly: true, fileMustExist: true });
  const pool = new Pool({ connectionString: targetUrl, max: 1 });
  let c: PoolClient | undefined;
  const rows = (name: string) =>
    sourceDb.prepare(`SELECT * FROM "${name}"`).all() as Record<string, unknown>[];
  const tables = sourceDb
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  const expected = new Set([
    "users",
    "sessions",
    "accounts",
    "verification_tokens",
    "restaurants",
    "restaurant_members",
    "outlets",
    "restaurant_tables",
    "qr_codes",
    "menu_categories",
    "menu_items",
    "menu_item_variants",
    "menu_media",
    "orders",
    "order_items",
    "order_status_events",
    "subscription_plans",
    "restaurant_subscriptions",
    "media_assets",
    "ai_usage_records",
    "background_jobs",
    "audit_logs",
    "__drizzle_migrations",
  ]);
  try {
    if (
      sourceDb.pragma("integrity_check", { simple: true }) !== "ok" ||
      (sourceDb.pragma("foreign_key_check") as unknown[]).length
    )
      throw new Error("Invalid SQLite integrity or foreign keys; import aborted");
    for (const t of tables)
      if (!expected.has(t.name)) throw new Error(`Unmapped legacy table: ${t.name}`);
    if (rows("outlets").length)
      throw new Error("Legacy branch outlets require an explicit reviewed mapping; import aborted");
    const emails = new Set<string>();
    for (const u of rows("users")) {
      const e = String(u.email).toLowerCase();
      if (emails.has(e)) throw new Error("Normalized email collision; import aborted");
      emails.add(e);
      if (u.role !== "user")
        throw new Error(
          "Legacy platform role requires explicit review; no implicit admin migration"
        );
    }
    // Legacy email flags remain untrusted unless the source explicitly records verification.
    // Never import an active owner using an unverified identity; arrange independently reviewed
    // verification before cutover instead of bypassing the new membership trigger.
    const verifiedEmails = new Set(
      rows("users")
        .filter((u) => Boolean(u.email_verified))
        .map((u) => String(u.id))
    );
    for (const m of rows("restaurant_members"))
      if (m.is_active && m.role === "owner" && !verifiedEmails.has(String(m.user_id)))
        throw new Error("Legacy owner email needs verified ownership before activation");
    c = await pool.connect();
    await c.query("begin");
    await c.query("select pg_advisory_xact_lock(60312103)");
    for (const table of ["users", "organizations", "restaurants"])
      if ((await c.query(`select 1 from ${table} limit 1`)).rowCount)
        throw new Error("Import target must be empty");
    // Migration 0033 seeds canonical plans before legacy import begins.
    // Only these immutable target seeds are permissible; never overwrite a
    // previously imported/edited plan or silently erase the hosted catalog.
    const canonicalPlans = new Set(["plan_free", "plan_ordering", "plan_kitchen_pro"]);
    const existingPlans = (
      await c.query<{ id: string }>("select id from subscription_plans")
    ).rows;
    if (existingPlans.some((plan) => !canonicalPlans.has(plan.id)))
      throw new Error("Import target must be empty");
    if (rows("subscription_plans").some((plan) => canonicalPlans.has(String(plan.id))))
      throw new Error("Legacy subscription plan conflicts with the canonical billing catalog");
    await c.query(
      "alter table menu_categories disable trigger category_audit; alter table menu_items disable trigger item_audit"
    );
    const metadata = (
      await c.query<{ table_name: string; column_name: string; data_type: string }>(
        "select table_name,column_name,data_type from information_schema.columns where table_schema='public'"
      )
    ).rows;
    async function insert(table: string, row: Record<string, unknown>) {
      const cols = metadata.filter((m) => m.table_name === table);
      const mapped: Record<string, unknown> = {};
      for (const col of cols) {
        let value = row[col.column_name];
        if (value === undefined) continue;
        if (col.data_type === "boolean") value = value === null ? null : Boolean(value);
        if (col.data_type === "timestamp with time zone" && typeof value === "number")
          value = new Date(value * 1000);
        mapped[col.column_name] = value;
      }
      const names = Object.keys(mapped);
      await c!.query(
        `insert into "${table}" (${names.map((n) => `"${n}"`).join(",")}) values (${names.map((_, i) => `$${i + 1}`).join(",")})`,
        Object.values(mapped)
      );
    }
    const report: Record<string, number> = {};
    for (const u of rows("users")) {
      await insert("users", {
        ...u,
        email: String(u.email).toLowerCase(),
        name: u.name ?? "Imported user",
        email_verified: Boolean(u.email_verified),
      });
      if (u.password_hash)
        await insert("accounts", {
          id: `credential-${u.id}`,
          account_id: u.id,
          provider_id: "credential",
          user_id: u.id,
          password: u.password_hash,
        });
    }
    for (const a of rows("accounts")) {
      if (a.type === "credentials")
        throw new Error("Unexpected legacy credential account; reconcile manually");
      await insert("accounts", {
        ...a,
        account_id: a.provider_account_id,
        provider_id: a.provider,
        access_token_expires_at: a.expires_at,
      });
    }
    for (const restaurant of rows("restaurants")) {
      const id = String(restaurant.id),
        org = `org-${id}`;
      if (!timezones[id])
        throw new Error("Every legacy restaurant requires an explicit reviewed timezone mapping");
      new Intl.DateTimeFormat("en", { timeZone: timezones[id] });
      if (
        rows("restaurant_members").filter(
          (m) => m.restaurant_id === id && m.role === "owner" && m.is_active
        ).length !== 1
      )
        throw new Error("Each legacy restaurant requires one active owner");
      await insert("organizations", {
        id: org,
        name: restaurant.name,
        is_active: restaurant.is_active,
        mfa_required: false, // Give imported legacy owners a reviewed MFA enrollment window.
      });
      await insert("restaurants", {
        ...restaurant,
        organization_id: org,
        timezone: timezones[id],
        outlet_type: "restaurant",
        is_published: true,
      });
      await insert("brands", { id: `brand-${id}`, organization_id: org, name: restaurant.name });
      await insert("brand_outlets", {
        organization_id: org,
        brand_id: `brand-${id}`,
        outlet_id: id,
      });
      for (const m of rows("restaurant_members").filter((m) => m.restaurant_id === id)) {
        if (!["owner", "manager", "staff", "kitchen"].includes(String(m.role)))
          throw new Error("Unknown membership role");
        await insert("organization_members", {
          ...m,
          organization_id: org,
          role: m.role === "owner" ? "owner" : "member",
        });
        if (m.role !== "owner")
          await insert("outlet_grants", {
            organization_id: org,
            member_id: m.id,
            outlet_id: id,
            roles: [m.role === "staff" ? "service" : m.role],
          });
      }
    }
    for (const table of [
      "restaurant_tables",
      "qr_codes",
      "menu_categories",
      "menu_items",
      "menu_item_variants",
      "menu_media",
      "subscription_plans",
      "restaurant_subscriptions",
      "orders",
      "order_items",
      "order_status_events",
      "media_assets",
      "ai_usage_records",
      "background_jobs",
      "audit_logs",
    ]) {
      for (const row of rows(table)) await insert(table, row);
      // Pre-seeded canonical plans are not imported legacy rows.
      const count =
        table === "subscription_plans"
          ? (
              await c.query<{ count: string }>(
                "select count(*)::text as count from subscription_plans where id = any($1::text[])",
                [rows(table).map((plan) => String(plan.id))]
              )
            ).rows[0]!.count
          : (
              await c.query<{ count: string }>(`select count(*)::text as count from "${table}"`)
            ).rows[0]!.count;
      if (Number(count) !== rows(table).length) throw new Error(`Reconciliation failed: ${table}`);
      report[table] = Number(count);
    }
    for (const table of ["users", "restaurants"]) {
      const count = Number((await c.query(`select count(*) from ${table}`)).rows[0].count);
      if (count !== rows(table).length) throw new Error(`Reconciliation failed: ${table}`);
      report[table] = count;
    }
    const ids = (await c.query("select id,public_id from restaurants order by id")).rows;
    const sourceIds = rows("restaurants")
      .map((v) => ({ id: v.id, public_id: v.public_id }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    if (
      createHash("sha256").update(JSON.stringify(ids)).digest("hex") !==
      createHash("sha256").update(JSON.stringify(sourceIds)).digest("hex")
    )
      throw new Error("QR identity reconciliation failed");
    const memberIds = (await c.query("select id from organization_members order by id")).rows
      .map((v) => v.id)
      .sort();
    const expectedMembers = rows("restaurant_members")
      .map((v) => v.id)
      .sort();
    if (JSON.stringify(memberIds) !== JSON.stringify(expectedMembers))
      throw new Error("Membership reconciliation failed");
    const accountIds = (await c.query("select id from accounts order by id")).rows
      .map((v) => v.id)
      .sort();
    const expectedAccounts = [
      ...rows("accounts").map((v) => v.id),
      ...rows("users")
        .filter((v) => v.password_hash)
        .map((v) => `credential-${v.id}`),
    ].sort();
    if (JSON.stringify(accountIds) !== JSON.stringify(expectedAccounts))
      throw new Error("Account reconciliation failed");
    report.organization_members = memberIds.length;
    report.accounts = accountIds.length;
    await c.query(
      "alter table menu_categories enable trigger category_audit; alter table menu_items enable trigger item_audit"
    );
    await c.query("commit");
    return {
      counts: report,
      invalidatedSessions: rows("sessions").length,
      timezoneReviewRequired: true,
    };
  } catch (e) {
    await c?.query("rollback");
    throw e;
  } finally {
    c?.release();
    sourceDb.close();
    await pool.end();
  }
}
