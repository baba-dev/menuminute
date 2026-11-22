import { afterAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import { sql } from "drizzle-orm";
import { admin, fixture } from "./helpers";
import { withOutlet } from "../src/modules/tenancy/service";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
import { ForbiddenError } from "../src/lib/errors";
import { createCategory, createMenuItem } from "../src/modules/menus/service";
import { migrateDatabase } from "../scripts/migration-runner";

const TIFFIN_TABLES = [
  "tiffin_slots",
  "tiffin_week_menus",
  "tiffin_week_menu_combos",
  "tiffin_date_overrides",
  "tiffin_date_override_combos",
  "tiffin_combos",
  "tiffin_combo_items",
  "tiffin_combo_addons",
  "tiffin_areas",
];
const WRITE_FNS = [
  "tiffin_slot_save",
  "tiffin_combo_save",
  "tiffin_week_set",
  "tiffin_override_set",
] as const;
type WriteFn = (typeof WRITE_FNS)[number];
type Fn = WriteFn | "tiffin_menu_read";
const SIGNATURES = [
  "app_private.tiffin_can(text,text)",
  "app_private.tiffin_slot_save(text,jsonb)",
  "app_private.tiffin_combo_save(text,jsonb)",
  "app_private.tiffin_week_set(text,jsonb)",
  "app_private.tiffin_override_set(text,jsonb)",
  "app_private.tiffin_menu_read(text)",
];

const app = new Pool({ connectionString: process.env["DATABASE_URL"], max: 4 });
afterAll(async () => {
  await app.end();
});

type PgError = { code?: string; message?: string; constraint?: string };
type Json = Record<string, unknown>;

async function begin(client: PoolClient, userId: string, outletId: string) {
  await client.query("begin");
  await client.query(
    "select set_config('app.actor_id',$1,true),set_config('app.outlet_id',$2,true)",
    [userId, outletId]
  );
}

/** Calls a tiffin function as menuminute_app in one transaction with the actor and outlet set. */
async function call<T = Json>(
  userId: string,
  outletId: string,
  fn: Fn,
  arg?: unknown,
  sessionOutlet = outletId
): Promise<T> {
  const client = await app.connect();
  try {
    await begin(client, userId, sessionOutlet);
    const r =
      fn === "tiffin_menu_read"
        ? await client.query(`select app_private.tiffin_menu_read($1) as r`, [outletId])
        : await client.query(`select app_private.${fn}($1,$2::jsonb) as r`, [
            outletId,
            JSON.stringify(arg),
          ]);
    await client.query("commit");
    return r.rows[0].r as T;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

async function can(userId: string, outletId: string, mode: string, sessionOutlet = outletId) {
  const client = await app.connect();
  try {
    await begin(client, userId, sessionOutlet);
    const r = await client.query<{ r: boolean }>("select app_private.tiffin_can($1,$2) as r", [
      outletId,
      mode,
    ]);
    await client.query("commit");
    return r.rows[0]!.r;
  } finally {
    client.release();
  }
}

/** Asserts a PostgreSQL rejection by SQLSTATE and, when given, the exact message. */
async function expectPg(work: Promise<unknown>, code: string, message?: string) {
  let error: PgError | undefined;
  try {
    await work;
  } catch (e) {
    error = e as PgError;
  }
  expect(error, "expected the statement to be rejected").toBeDefined();
  expect(error!.code).toBe(code);
  if (message !== undefined) expect(error!.message).toBe(message);
}

async function tiffinFixture(currency = "INR") {
  const f = await fixture(currency);
  await admin(async (_db, pool) => {
    await pool.query("update restaurants set outlet_type='tiffin' where id=$1", [f.outlet.id]);
  });
  return { ...f, org: f.outlet.organizationId, userId: f.actor.userId };
}

/** Adds an organization member with an optional outlet grant; returns the member's user id. */
async function addMember(
  org: string,
  outletId: string,
  roles: string[] | null,
  orgRole: "member" | "admin" = "member"
) {
  const userId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Tiffin member',$2,true)",
      [userId, `${userId}@tiffin.invalid`]
    );
    await pool.query(
      "insert into organization_members(id,organization_id,user_id,role,is_active) values($1,$2,$3,$4,true)",
      [memberId, org, userId, orgRole]
    );
    if (roles)
      await pool.query(
        "insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,$4::text[])",
        [org, memberId, outletId, roles]
      );
  });
  return userId;
}

/** A second outlet in the same organization, converted to tiffin. */
async function secondOutlet(actor: { userId: string }, org: string) {
  const version = (await listOrganizations(actor)).find((o) => o.id === org)!.version;
  const created = await manageOrganization(actor, org, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: {
      action: "outlet.create",
      data: {
        name: "Second Kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "takeout",
        fulfillmentModes: ["pickup"],
      },
    },
  });
  const id = String(created.outletId);
  await admin(async (_db, pool) => {
    await pool.query("update restaurants set outlet_type='tiffin' where id=$1", [id]);
  });
  return id;
}

const combo = (name = "Veg thali", extra: Json = {}) => ({
  name,
  description: "Dal, sabzi, rice",
  priceMinor: 9000,
  items: [
    { label: "Roti", quantity: 4 },
    { label: "Dal", quantity: 1 },
  ],
  addons: [{ label: "Extra roti", priceMinor: 1000 }],
  ...extra,
});
const lunch = (extra: Json = {}) => ({
  kind: "lunch",
  startMinute: 720,
  endMinute: 840,
  cutoffMinutesBefore: 120,
  capacity: null,
  ...extra,
});

async function localToday(timezone = "Asia/Kolkata") {
  return admin(async (_db, pool) => {
    const r = await pool.query<{ d: string }>(
      "select ((statement_timestamp() at time zone $1)::date)::text as d",
      [timezone]
    );
    return r.rows[0]!.d;
  });
}
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("tiffin menu commands 0115 — definer function hardening", () => {
  it("every function is SECURITY DEFINER, pins search_path and is granted only to menuminute_app", async () => {
    await admin(async (_db, pool) => {
      for (const sig of SIGNATURES) {
        const r = await pool.query<{
          secdef: boolean;
          config: string[] | null;
          app: boolean;
          worker: boolean;
          pub: boolean;
        }>(
          `select p.prosecdef as secdef,p.proconfig as config,
             has_function_privilege('menuminute_app',p.oid,'EXECUTE') as app,
             has_function_privilege('menuminute_worker',p.oid,'EXECUTE') as worker,
             exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                    where a.grantee=0 and a.privilege_type='EXECUTE') as pub
           from pg_proc p where p.oid=$1::regprocedure`,
          [sig]
        );
        const row = r.rows[0]!;
        expect(row.secdef, sig).toBe(true);
        expect(row.config, sig).toEqual(["search_path=pg_catalog, public, pg_temp"]);
        expect(row.app, sig).toBe(true);
        expect(row.worker, sig).toBe(false);
        expect(row.pub, sig).toBe(false);
      }
      const guard = await pool.query<{ secdef: boolean; pub: boolean; app: boolean }>(
        `select p.prosecdef as secdef,
           exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                  where a.grantee=0) as pub,
           has_function_privilege('menuminute_app',p.oid,'EXECUTE') as app
         from pg_proc p where p.oid='app_private.guard_tiffin_currency()'::regprocedure`
      );
      expect(guard.rows[0]).toEqual({ secdef: true, pub: false, app: false });
      const trig = await pool.query<{ tgname: string }>(
        "select tgname from pg_trigger where tgrelid='restaurants'::regclass and tgname='tiffin_currency_guard'"
      );
      expect(trig.rows).toHaveLength(1);
    });
  });

  it("keeps the nine phase 1 tables directly inaccessible to menuminute_app and menuminute_worker", async () => {
    for (const env of ["DATABASE_URL", "WORKER_DATABASE_URL"]) {
      const pool = new Pool({ connectionString: process.env[env], max: 1 });
      try {
        for (const table of TIFFIN_TABLES)
          await expectPg(
            pool.query(`select 1 from ${table}`),
            "42501",
            `permission denied for table ${table}`
          );
      } finally {
        await pool.end();
      }
    }
  });

  it("the worker role cannot execute the command functions", async () => {
    const f = await tiffinFixture();
    const pool = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 1 });
    try {
      await expectPg(
        pool.query("select app_private.tiffin_menu_read($1)", [f.outlet.id]),
        "42501",
        "permission denied for function tiffin_menu_read"
      );
    } finally {
      await pool.end();
    }
  });
});

describe("tiffin menu commands 0115 — authorization", () => {
  it("owner saves a combo through withOutlet and reads it back in the outlet currency", async () => {
    const f = await tiffinFixture("OMR");
    // A client-supplied currency is ignored: the server stores the outlet currency.
    const created = await withOutlet(f.actor, f.outlet.id, "menu.write", async (tx) => {
      const r = await tx.execute<{ r: Json }>(
        sql`select app_private.tiffin_combo_save(${f.outlet.id},${JSON.stringify(
          combo("Veg thali", { currency: "USD" })
        )}::jsonb) as r`
      );
      return r.rows[0]!.r;
    });
    expect(created).toMatchObject({
      name: "Veg thali",
      priceMinor: 9000,
      currency: "OMR",
      archived: false,
    });
    const menu = await withOutlet(f.actor, f.outlet.id, "menu.read", async (tx) => {
      const r = await tx.execute<{ r: Json }>(
        sql`select app_private.tiffin_menu_read(${f.outlet.id}) as r`
      );
      return r.rows[0]!.r;
    });
    const combos = menu["combos"] as Json[];
    expect(combos).toHaveLength(1);
    expect(combos[0]).toMatchObject({
      id: created["id"],
      currency: "OMR",
      items: [
        { label: "Roti", quantity: 4 },
        { label: "Dal", quantity: 1 },
      ],
      addons: [{ label: "Extra roti", priceMinor: 1000 }],
    });
  });

  it("owner, org admin, manager and menu editor can write; service and kitchen can read only", async () => {
    const f = await tiffinFixture();
    const orgAdmin = await addMember(f.org, f.outlet.id, null, "admin");
    const manager = await addMember(f.org, f.outlet.id, ["manager"]);
    const editor = await addMember(f.org, f.outlet.id, ["menu_editor"]);
    const service = await addMember(f.org, f.outlet.id, ["service"]);
    const kitchen = await addMember(f.org, f.outlet.id, ["kitchen"]);
    const noGrant = await addMember(f.org, f.outlet.id, null);
    for (const [i, u] of [f.userId, orgAdmin, manager, editor].entries()) {
      expect(await can(u, f.outlet.id, "write")).toBe(true);
      await call(u, f.outlet.id, "tiffin_combo_save", combo(`Combo ${i}`));
    }
    for (const u of [service, kitchen]) {
      expect(await can(u, f.outlet.id, "read")).toBe(true);
      expect(await can(u, f.outlet.id, "write")).toBe(false);
      const menu = await call(u, f.outlet.id, "tiffin_menu_read");
      expect(menu["combos"] as Json[]).toHaveLength(4);
      for (const fn of WRITE_FNS)
        await expectPg(call(u, f.outlet.id, fn, {}), "42501", "Not allowed");
      // The application gate denies the write lock as well.
      await expect(
        withOutlet({ userId: u }, f.outlet.id, "menu.write", async () => 1)
      ).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await can(noGrant, f.outlet.id, "read")).toBe(false);
    await expectPg(call(noGrant, f.outlet.id, "tiffin_menu_read"), "42501", "Not allowed");
  });

  it("denies a foreign organization, a restaurant outlet, a mismatched session outlet and inactive tenants", async () => {
    const f = await tiffinFixture();
    const other = await tiffinFixture();
    expect(await can(other.userId, f.outlet.id, "read")).toBe(false);
    await expectPg(call(other.userId, f.outlet.id, "tiffin_menu_read"), "42501", "Not allowed");
    await expectPg(
      call(other.userId, f.outlet.id, "tiffin_combo_save", combo()),
      "42501",
      "Not allowed"
    );
    // The selector must equal the transaction's app.outlet_id.
    expect(await can(f.userId, f.outlet.id, "read", other.outlet.id)).toBe(false);
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_slot_save", lunch(), other.outlet.id),
      "42501",
      "Not allowed"
    );
    // A restaurant outlet is not tiffin: denied as if the feature did not exist.
    const plain = await fixture();
    expect(await can(plain.actor.userId, plain.outlet.id, "read")).toBe(false);
    expect(await can(plain.actor.userId, plain.outlet.id, "write")).toBe(false);
    await expectPg(
      call(plain.actor.userId, plain.outlet.id, "tiffin_combo_save", combo()),
      "42501",
      "Not allowed"
    );
    // Inactive outlet, then inactive organization.
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_active=false where id=$1", [f.outlet.id]);
    });
    expect(await can(f.userId, f.outlet.id, "read")).toBe(false);
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_active=true where id=$1", [f.outlet.id]);
      await pool.query("update organizations set is_active=false where id=$1", [f.org]);
    });
    expect(await can(f.userId, f.outlet.id, "read")).toBe(false);
    await expectPg(call(f.userId, f.outlet.id, "tiffin_menu_read"), "42501", "Not allowed");
  });

  it("never touches another outlet's combo by id: missing and foreign ids fail the same way", async () => {
    const f = await tiffinFixture();
    const other = await tiffinFixture();
    const foreign = await call(other.userId, other.outlet.id, "tiffin_combo_save", combo());
    for (const id of [String(foreign["id"]), "does-not-exist"])
      await expectPg(
        call(f.userId, f.outlet.id, "tiffin_combo_save", { ...combo("Hijack"), id }),
        "22023",
        "Combo not allowed"
      );
    const theirs = await call(other.userId, other.outlet.id, "tiffin_menu_read");
    expect((theirs["combos"] as Json[])[0]).toMatchObject({ name: "Veg thali" });
  });
});

describe("tiffin menu commands 0115 — combos", () => {
  it("validates combo input inside the function", async () => {
    const f = await tiffinFixture();
    const bad: unknown[] = [
      null,
      [],
      "x",
      { ...combo(), unknown: 1 },
      { ...combo(), name: "   " },
      { ...combo(), name: "x".repeat(81) },
      { ...combo(), name: 5 },
      { ...combo(), description: "x".repeat(301) },
      { ...combo(), description: null },
      { ...combo(), priceMinor: -1 },
      { ...combo(), priceMinor: 2147483648 },
      { ...combo(), priceMinor: 1.5 },
      { ...combo(), priceMinor: "9000" },
      { ...combo(), items: [] },
      { ...combo(), items: Array.from({ length: 21 }, () => ({ label: "Roti", quantity: 1 })) },
      { ...combo(), items: [{ label: "Roti", quantity: 0 }] },
      { ...combo(), items: [{ label: "Roti", quantity: 100 }] },
      { ...combo(), items: [{ label: "", quantity: 1 }] },
      { ...combo(), items: [{ label: "Roti", quantity: 1, extra: true }] },
      { ...combo(), items: "Roti" },
      { ...combo(), addons: Array.from({ length: 21 }, () => ({ label: "A", priceMinor: 1 })) },
      { ...combo(), addons: [{ label: "A", priceMinor: -1 }] },
      { ...combo(), addons: [{ label: "x".repeat(81), priceMinor: 1 }] },
      { ...combo(), archived: "yes" },
      { ...combo(), id: "" },
      { ...combo(), id: "x".repeat(65) },
      { name: "No items", priceMinor: 1, addons: [] },
    ];
    for (const p of bad)
      await expectPg(call(f.userId, f.outlet.id, "tiffin_combo_save", p), "22023", "Invalid combo");
    // Trimmed names and maximum bounds are accepted.
    const ok = await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      name: "  Max  ",
      priceMinor: 2147483647,
      items: Array.from({ length: 20 }, (_, i) => ({ label: `Item ${i}`, quantity: 99 })),
      addons: Array.from({ length: 20 }, (_, i) => ({ label: `Add ${i}`, priceMinor: 0 })),
    });
    expect(ok).toMatchObject({ name: "Max", description: "", priceMinor: 2147483647 });
    expect(ok["items"] as Json[]).toHaveLength(20);
    expect((ok["items"] as Json[]).map((i) => i["label"])).toEqual(
      Array.from({ length: 20 }, (_, i) => `Item ${i}`)
    );
  });

  it("updates replace items and add-ons and archive/restore toggles without losing data", async () => {
    const f = await tiffinFixture();
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    const id = String(c["id"]);
    const updated = await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      ...combo("Deluxe thali", { priceMinor: 12000 }),
      id,
      items: [{ label: "Paneer", quantity: 1 }],
      addons: [],
    });
    expect(updated).toMatchObject({
      id,
      name: "Deluxe thali",
      priceMinor: 12000,
      items: [{ label: "Paneer", quantity: 1 }],
      addons: [],
    });
    const archived = await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      id,
      archived: true,
    });
    expect(archived).toMatchObject({ id, archived: true, name: "Deluxe thali" });
    let menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["combos"]).toEqual([]);
    expect((menu["archivedCombos"] as Json[]).map((x) => x["id"])).toEqual([id]);
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", { archived: true }),
      "22023",
      "Invalid combo"
    );
    const restored = await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      id,
      archived: false,
    });
    expect(restored).toMatchObject({ id, archived: false, items: [{ label: "Paneer" }] });
    menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect((menu["combos"] as Json[]).map((x) => x["id"])).toEqual([id]);
  });

  it("rejects the 201st live combo with 54000 and archiving one frees a slot", async () => {
    const f = await tiffinFixture();
    await admin(async (_db, pool) => {
      await pool.query(
        `insert into tiffin_combos(organization_id,outlet_id,name,price_minor,currency)
         select $1,$2,'Bulk '||g,100,'INR' from generate_series(1,199) g`,
        [f.org, f.outlet.id]
      );
      // Archived rows never count towards the cap.
      await pool.query(
        `insert into tiffin_combos(organization_id,outlet_id,name,price_minor,currency,archived)
         select $1,$2,'Old '||g,100,'INR',true from generate_series(1,5) g`,
        [f.org, f.outlet.id]
      );
    });
    const twoHundredth = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo("200th"));
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", combo("201st")),
      "54000",
      "Combo limit reached"
    );
    // Updating an existing live combo is not blocked by the cap.
    await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      ...combo("200th renamed"),
      id: twoHundredth["id"],
    });
    await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      id: twoHundredth["id"],
      archived: true,
    });
    const replacement = await call(
      f.userId,
      f.outlet.id,
      "tiffin_combo_save",
      combo("Replacement")
    );
    expect(replacement["archived"]).toBe(false);
    // Restoring an archived combo while at the cap is rejected too.
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", {
        id: twoHundredth["id"],
        archived: false,
      }),
      "54000",
      "Combo limit reached"
    );
    // The cap is per outlet.
    const other = await tiffinFixture();
    await call(other.userId, other.outlet.id, "tiffin_combo_save", combo());
  });

  it("serializes concurrent saves of one combo: exactly one coherent item list survives", async () => {
    const f = await tiffinFixture();
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    const id = String(c["id"]);
    const listA = [
      { label: "A1", quantity: 1 },
      { label: "A2", quantity: 2 },
      { label: "A3", quantity: 3 },
    ];
    const listB = [{ label: "B1", quantity: 9 }];
    const c1 = await app.connect();
    const c2 = await app.connect();
    try {
      await begin(c1, f.userId, f.outlet.id);
      await begin(c2, f.userId, f.outlet.id);
      await c1.query("select app_private.tiffin_combo_save($1,$2::jsonb)", [
        f.outlet.id,
        JSON.stringify({ ...combo(), id, items: listA }),
      ]);
      // c2 blocks on the per-outlet advisory lock until c1 commits.
      const second = c2.query("select app_private.tiffin_combo_save($1,$2::jsonb)", [
        f.outlet.id,
        JSON.stringify({ ...combo(), id, items: listB, addons: [] }),
      ]);
      const waiting = await admin(async (_db, pool) => {
        for (let i = 0; i < 50; i++) {
          const r = await pool.query<{ n: number }>(
            "select count(*)::int as n from pg_locks where locktype='advisory' and not granted"
          );
          if (r.rows[0]!.n > 0) return true;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        return false;
      });
      expect(waiting).toBe(true);
      await c1.query("commit");
      await second;
      await c2.query("commit");
    } finally {
      c1.release();
      c2.release();
    }
    const menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    const saved = (menu["combos"] as Json[])[0]!;
    expect((saved["items"] as Json[]).map(({ label, quantity }) => ({ label, quantity }))).toEqual(
      listB
    );
    expect(saved["addons"]).toEqual([]);
    const rows = await admin(async (_db, pool) =>
      pool.query<{ n: number }>(
        "select count(*)::int as n from tiffin_combo_items where combo_id=$1",
        [id]
      )
    );
    expect(rows.rows[0]!.n).toBe(1);
  });

  it("rolls back a failing save completely (no half-written items)", async () => {
    const f = await tiffinFixture();
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", {
        ...combo(),
        id: c["id"],
        items: [
          { label: "Good", quantity: 1 },
          { label: "Bad", quantity: 100 },
        ],
      }),
      "22023",
      "Invalid combo"
    );
    const menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(((menu["combos"] as Json[])[0]!["items"] as Json[]).map((i) => i["label"])).toEqual([
      "Roti",
      "Dal",
    ]);
  });
});

describe("tiffin menu commands 0115 — slots, week and overrides", () => {
  it("upserts slots with validation", async () => {
    const f = await tiffinFixture();
    const s1 = await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    expect(s1).toMatchObject({
      kind: "lunch",
      startMinute: 720,
      endMinute: 840,
      cutoffMinutesBefore: 120,
      capacity: null,
      enabled: true,
    });
    const s2 = await call(
      f.userId,
      f.outlet.id,
      "tiffin_slot_save",
      lunch({ startMinute: 660, capacity: 40, enabled: false })
    );
    expect(s2).toMatchObject({ id: s1["id"], startMinute: 660, capacity: 40, enabled: false });
    // Omitting enabled on update keeps the stored value.
    const s3 = await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    expect(s3).toMatchObject({ id: s1["id"], enabled: false, capacity: null });
    const bad: unknown[] = [
      lunch({ kind: "breakfast" }),
      lunch({ startMinute: -1 }),
      lunch({ startMinute: 1440 }),
      lunch({ endMinute: 1441 }),
      lunch({ startMinute: 800, endMinute: 800 }),
      lunch({ cutoffMinutesBefore: 10081 }),
      lunch({ capacity: 0 }),
      lunch({ capacity: 2147483648 }),
      lunch({ enabled: "true" }),
      lunch({ extra: 1 }),
      { kind: "lunch", startMinute: 720, endMinute: 840, cutoffMinutesBefore: 0 },
    ];
    for (const p of bad)
      await expectPg(call(f.userId, f.outlet.id, "tiffin_slot_save", p), "22023", "Invalid slot");
    const menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["slots"]).toHaveLength(1);
  });

  it("sets a weekday menu from same-outlet, live combos only", async () => {
    const f = await tiffinFixture();
    const b = await secondOutlet(f.actor, f.org);
    const other = await tiffinFixture();
    const mine = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo("Mine"));
    const mine2 = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo("Mine 2"));
    const sibling = await call(f.userId, b, "tiffin_combo_save", combo("Sibling"));
    const foreign = await call(other.userId, other.outlet.id, "tiffin_combo_save", combo());
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_week_set", {
        slotKind: "lunch",
        weekday: 1,
        comboIds: [mine["id"]],
      }),
      "22023",
      "Slot not configured"
    );
    await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    // Combo from outlet B (same organization) and from another organization: rejected.
    for (const id of [sibling["id"], foreign["id"], "missing"])
      await expectPg(
        call(f.userId, f.outlet.id, "tiffin_week_set", {
          slotKind: "lunch",
          weekday: 1,
          comboIds: [mine["id"], id],
        }),
        "22023",
        "Combo not allowed"
      );
    const set = await call(f.userId, f.outlet.id, "tiffin_week_set", {
      slotKind: "lunch",
      weekday: 1,
      comboIds: [mine2["id"], mine["id"]],
    });
    expect(set).toEqual({ slotKind: "lunch", weekday: 1, comboIds: [mine2["id"], mine["id"]] });
    // Archived combos cannot be placed on a week.
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { id: mine2["id"], archived: true });
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_week_set", {
        slotKind: "lunch",
        weekday: 2,
        comboIds: [mine2["id"]],
      }),
      "22023",
      "Combo not allowed"
    );
    // Read hides archived combos from the week entry but keeps the link (restore brings it back).
    let menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["week"]).toEqual([{ slotKind: "lunch", weekday: 1, comboIds: [mine["id"]] }]);
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { id: mine2["id"], archived: false });
    menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["week"]).toEqual([
      { slotKind: "lunch", weekday: 1, comboIds: [mine2["id"], mine["id"]] },
    ]);
    // An empty list clears the weekday.
    await call(f.userId, f.outlet.id, "tiffin_week_set", {
      slotKind: "lunch",
      weekday: 1,
      comboIds: [],
    });
    menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["week"]).toEqual([]);
    const bad: unknown[] = [
      { slotKind: "lunch", weekday: 7, comboIds: [] },
      { slotKind: "lunch", weekday: -1, comboIds: [] },
      { slotKind: "lunch", weekday: 1.5, comboIds: [] },
      { slotKind: "brunch", weekday: 1, comboIds: [] },
      { slotKind: "lunch", weekday: 1, comboIds: [mine["id"], mine["id"]] },
      { slotKind: "lunch", weekday: 1, comboIds: Array.from({ length: 51 }, (_, i) => `c${i}`) },
      { slotKind: "lunch", weekday: 1, comboIds: [""] },
      { slotKind: "lunch", weekday: 1, comboIds: [7] },
      { slotKind: "lunch", weekday: 1 },
      { slotKind: "lunch", weekday: 1, comboIds: [], extra: true },
    ];
    for (const p of bad)
      await expectPg(
        call(f.userId, f.outlet.id, "tiffin_week_set", p),
        "22023",
        "Invalid week menu"
      );
  });

  it("date overrides replace the day: closed offers nothing, open offers exactly its combos", async () => {
    const f = await tiffinFixture();
    const other = await tiffinFixture();
    await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    const c1 = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo("One"));
    const c2 = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo("Two"));
    const foreign = await call(other.userId, other.outlet.id, "tiffin_combo_save", combo());
    const today = await localToday();
    const d1 = addDays(today, 3);
    const d2 = addDays(today, 4);
    const closed = await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d1,
      closed: true,
      comboIds: [],
    });
    expect(closed).toEqual({ slotKind: "lunch", localDate: d1, closed: true, comboIds: [] });
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_override_set", {
        slotKind: "lunch",
        localDate: d1,
        closed: true,
        comboIds: [c1["id"]],
      }),
      "22023",
      "Invalid override"
    );
    await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d2,
      closed: false,
      comboIds: [c2["id"], c1["id"]],
    });
    // Re-setting d2 replaces its combo set.
    await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d2,
      closed: false,
      comboIds: [c2["id"]],
    });
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_override_set", {
        slotKind: "lunch",
        localDate: d2,
        closed: false,
        comboIds: [foreign["id"]],
      }),
      "22023",
      "Combo not allowed"
    );
    // Old overrides (before outlet-local yesterday) are not returned; yesterday is.
    const slotId = ((await call(f.userId, f.outlet.id, "tiffin_menu_read"))["slots"] as Json[])[0]![
      "id"
    ];
    await admin(async (_db, pool) => {
      for (const d of [addDays(today, -1), addDays(today, -2)])
        await pool.query(
          `insert into tiffin_date_overrides(organization_id,outlet_id,slot_id,local_date,closed)
           values($1,$2,$3,$4,true)`,
          [f.org, f.outlet.id, slotId, d]
        );
    });
    let menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(menu["overrides"]).toEqual([
      { slotKind: "lunch", localDate: addDays(today, -1), closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: d1, closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: d2, closed: false, comboIds: [c2["id"]] },
    ]);
    const cleared = await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d1,
      clear: true,
    });
    expect(cleared).toEqual({ slotKind: "lunch", localDate: d1, cleared: true });
    menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect((menu["overrides"] as Json[]).map((o) => o["localDate"])).toEqual([
      addDays(today, -1),
      d2,
    ]);
    const bad: unknown[] = [
      { slotKind: "lunch", localDate: addDays(today, -1), closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: addDays(today, 367), closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: "2027-02-30", closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: "2027-1-01", closed: true, comboIds: [] },
      { slotKind: "lunch", localDate: d1, closed: "no", comboIds: [] },
      { slotKind: "lunch", localDate: d1, comboIds: [] },
      { slotKind: "lunch", localDate: d1, closed: false, comboIds: [c1["id"], c1["id"]] },
      { slotKind: "lunch", localDate: d1, clear: "true" },
      { slotKind: "lunch", localDate: d1, closed: false, comboIds: [], extra: 1 },
    ];
    for (const p of bad)
      await expectPg(
        call(f.userId, f.outlet.id, "tiffin_override_set", p),
        "22023",
        "Invalid override"
      );
    // The last date of the window is accepted.
    await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: addDays(today, 366),
      closed: true,
      comboIds: [],
    });
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_override_set", {
        slotKind: "dinner",
        localDate: d1,
        closed: true,
        comboIds: [],
      }),
      "22023",
      "Slot not configured"
    );
  });

  it("returns the documented read shape", async () => {
    const f = await tiffinFixture();
    await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    await call(f.userId, f.outlet.id, "tiffin_week_set", {
      slotKind: "lunch",
      weekday: 0,
      comboIds: [c["id"]],
    });
    const menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect(Object.keys(menu).sort()).toEqual(
      ["archivedCombos", "combos", "outlet", "overrides", "slots", "week"].sort()
    );
    expect(menu["outlet"]).toEqual({
      id: f.outlet.id,
      currency: "INR",
      timezone: "Asia/Kolkata",
      today: await localToday(),
    });
    const slot = (menu["slots"] as Json[])[0]!;
    expect(Object.keys(slot).sort()).toEqual(
      [
        "capacity",
        "cutoffMinutesBefore",
        "enabled",
        "endMinute",
        "id",
        "kind",
        "startMinute",
      ].sort()
    );
    const saved = (menu["combos"] as Json[])[0]!;
    expect(Object.keys(saved).sort()).toEqual(
      ["addons", "archived", "currency", "description", "id", "items", "name", "priceMinor"].sort()
    );
    expect(Object.keys((saved["items"] as Json[])[0]!).sort()).toEqual(["id", "label", "quantity"]);
    expect(Object.keys((saved["addons"] as Json[])[0]!).sort()).toEqual([
      "id",
      "label",
      "priceMinor",
    ]);
    expect(menu["week"]).toEqual([{ slotKind: "lunch", weekday: 0, comboIds: [c["id"]] }]);
  });
});

describe("tiffin menu commands 0115 — audit and currency guard", () => {
  it("writes an audit_logs row for every write in the same transaction", async () => {
    const f = await tiffinFixture();
    await call(f.userId, f.outlet.id, "tiffin_slot_save", lunch());
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { ...combo("Renamed"), id: c["id"] });
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { id: c["id"], archived: true });
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { id: c["id"], archived: false });
    await call(f.userId, f.outlet.id, "tiffin_week_set", {
      slotKind: "lunch",
      weekday: 3,
      comboIds: [c["id"]],
    });
    const d = addDays(await localToday(), 2);
    await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d,
      closed: true,
      comboIds: [],
    });
    await call(f.userId, f.outlet.id, "tiffin_override_set", {
      slotKind: "lunch",
      localDate: d,
      clear: true,
    });
    // A rejected write leaves no audit row.
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", { ...combo(), priceMinor: -1 }),
      "22023"
    );
    await call(f.userId, f.outlet.id, "tiffin_menu_read");
    const rows = await admin(async (_db, pool) =>
      pool.query<{
        user_id: string;
        action: string;
        resource_type: string;
        before: string | null;
        after: string | null;
      }>(
        `select user_id,action,resource_type,before,after from audit_logs
         where restaurant_id=$1 and resource_type like 'tiffin%' order by created_at,id`,
        [f.outlet.id]
      )
    );
    expect(rows.rows.map((r) => [r.action, r.resource_type])).toEqual([
      ["tiffin.slot.save", "tiffin_slot"],
      ["tiffin.combo.create", "tiffin_combo"],
      ["tiffin.combo.update", "tiffin_combo"],
      ["tiffin.combo.archive", "tiffin_combo"],
      ["tiffin.combo.restore", "tiffin_combo"],
      ["tiffin.week.set", "tiffin_week_menu"],
      ["tiffin.override.set", "tiffin_date_override"],
      ["tiffin.override.clear", "tiffin_date_override"],
    ]);
    expect(rows.rows.every((r) => r.user_id === f.userId)).toBe(true);
    const update = rows.rows[2]!;
    expect(JSON.parse(update.before!)).toMatchObject({ name: "Veg thali" });
    expect(JSON.parse(update.after!)).toMatchObject({ name: "Renamed" });
    expect(rows.rows[1]!.before).toBeNull();
  });

  it("blocks a currency change while a live combo is priced in another currency", async () => {
    const f = await tiffinFixture();
    const c = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    await admin(async (_db, pool) => {
      // Isolate this trigger from the 0005 menu-document guard.
      await pool.query(
        `update menus set document=jsonb_set(document,'{currency}','"USD"')
         where id in (select menu_id from menu_assignments where outlet_id=$1)`,
        [f.outlet.id]
      );
      await expectPg(
        pool.query("update restaurants set currency='USD' where id=$1", [f.outlet.id]),
        "22023",
        "Explicit repricing required"
      );
      // Unrelated updates of the row are not affected.
      await pool.query("update restaurants set name='Renamed kitchen' where id=$1", [f.outlet.id]);
    });
    await call(f.userId, f.outlet.id, "tiffin_combo_save", { id: c["id"], archived: true });
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set currency='USD' where id=$1", [f.outlet.id]);
    });
    // Restoring an archived combo priced in the old currency needs explicit repricing.
    await expectPg(
      call(f.userId, f.outlet.id, "tiffin_combo_save", { id: c["id"], archived: false }),
      "22023",
      "Explicit repricing required"
    );
    const repriced = await call(f.userId, f.outlet.id, "tiffin_combo_save", {
      ...combo(),
      id: c["id"],
      archived: false,
      priceMinor: 300,
    });
    expect(repriced).toMatchObject({ currency: "USD", archived: false, priceMinor: 300 });
  });

  it("leaves outlet currency changes and the existing 0003/0005 guards unchanged", async () => {
    const f = await fixture();
    const org = f.outlet.organizationId;
    const update = async (outletId: string, data: Json) => {
      const version = (await listOrganizations(f.actor)).find((o) => o.id === org)!.version;
      return manageOrganization(f.actor, org, {
        key: crypto.randomUUID(),
        expectedVersion: version,
        command: { action: "outlet.update", data: { outletId, ...data } },
      });
    };
    const currencyOf = async (outletId: string) =>
      admin(async (_db, pool) => {
        const r = await pool.query<{ currency: string }>(
          "select currency from restaurants where id=$1",
          [outletId]
        );
        return r.rows[0]!.currency;
      });
    // A restaurant outlet with no menu document and no combos changes currency normally.
    const version = (await listOrganizations(f.actor)).find((o) => o.id === org)!.version;
    const created = await manageOrganization(f.actor, org, {
      key: crypto.randomUUID(),
      expectedVersion: version,
      command: {
        action: "outlet.create",
        data: {
          name: "Plain outlet",
          country: "IN",
          currency: "INR",
          timezone: "Asia/Kolkata",
          outletType: "restaurant",
          fulfillmentModes: ["dine_in"],
        },
      },
    });
    const plain = String(created.outletId);
    await update(plain, { currency: "USD" });
    expect(await currencyOf(plain)).toBe("USD");
    // A tiffin outlet with no live combos changes too; with a live combo the command is refused.
    const tiffin = await secondOutlet(f.actor, org);
    await update(tiffin, { currency: "USD" });
    expect(await currencyOf(tiffin)).toBe("USD");
    await call(f.actor.userId, tiffin, "tiffin_combo_save", combo());
    await expect(update(tiffin, { currency: "INR" })).rejects.toMatchObject({ statusCode: 422 });
    expect(await currencyOf(tiffin)).toBe("USD");
    // 0005 menu-document guard still fires for the provisioned outlet (its menu is priced in INR).
    await admin(async (_db, pool) => {
      await expectPg(
        pool.query("update restaurants set currency='USD' where id=$1", [f.outlet.id]),
        "22023",
        "Explicit menu repricing required"
      );
    });
    await expect(update(f.outlet.id, { currency: "USD" })).rejects.toMatchObject({
      statusCode: 422,
    });
    // 0003 manage_organization guard still rejects once the outlet has priced dishes, even when
    // the menu document no longer blocks.
    const category = await createCategory(f.actor, f.outlet.id, { name: "Prices" });
    await createMenuItem(f.actor, f.outlet.id, {
      categoryId: category.id,
      name: "Priced dish",
      priceRupees: 10,
    });
    await admin(async (_db, pool) => {
      await pool.query(
        `update menus set document=jsonb_set(document,'{currency}','"USD"')
         where id in (select menu_id from menu_assignments where outlet_id=$1)`,
        [f.outlet.id]
      );
    });
    await expect(update(f.outlet.id, { currency: "USD" })).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(await currencyOf(f.outlet.id)).toBe("INR");
  });
});

describe("tiffin menu commands 0115 — migration ledger", () => {
  it("is applied once: a second migrateDatabase leaves the ledger equal to the journal", async () => {
    await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]!);
    await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]!);
    await admin(async (_db, pool) => {
      const journal = JSON.parse(
        await readFile("src/db/migrations/meta/_journal.json", "utf8")
      ) as { entries: { idx: number; tag: string; when: number }[] };
      const last = journal.entries.at(-1)!;
      expect(last).toMatchObject({ idx: 114, tag: "0115_tiffin_menu_commands" });
      expect(last.when).toBeGreaterThan(journal.entries.at(-2)!.when);
      const names = (
        await pool.query<{ name: string }>("select name from drizzle.foundation_migrations")
      ).rows.map((row) => row.name);
      expect(names.sort()).toEqual(journal.entries.map((e) => e.tag).sort());
    });
  });
});

describe("tiffin menu commands 0115 — lock ordering with organization and currency changes", () => {
  const owner = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 2 });
  afterAll(async () => {
    await owner.end();
  });

  /** Resolves once the backend `pid` is blocked on a heavyweight lock (deterministic, no fixed sleep). */
  async function waitUntilBlocked(pid: number) {
    for (let i = 0; i < 500; i++) {
      const r = await owner.query<{ n: number }>(
        "select count(*)::int as n from pg_stat_activity where pid=$1 and wait_event_type='Lock'",
        [pid]
      );
      if (r.rows[0]!.n > 0) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`backend ${pid} never blocked on a lock`);
  }
  async function pidOf(client: PoolClient) {
    return (await client.query<{ pid: number }>("select pg_backend_pid() as pid")).rows[0]!.pid;
  }
  async function setMenuCurrency(outletId: string, currency: string) {
    await owner.query(
      `update menus set document=jsonb_set(document,'{currency}',to_jsonb($2::text))
       where id in (select menu_id from menu_assignments where outlet_id=$1)`,
      [outletId, currency]
    );
  }
  async function stored(outletId: string) {
    const r = await owner.query<{ outlet: string; combos: string[] }>(
      `select r.currency as outlet,
         coalesce((select array_agg(c.currency order by c.created_at) from tiffin_combos c
                   where c.outlet_id=r.id and not c.archived),'{}') as combos
       from restaurants r where r.id=$1`,
      [outletId]
    );
    return r.rows[0]!;
  }

  it("a combo save racing a manage_organization-style org lock + restaurants update never deadlocks", async () => {
    const f = await tiffinFixture();
    const existing = await call(f.userId, f.outlet.id, "tiffin_combo_save", combo());
    const org = await owner.connect();
    const save = await app.connect();
    try {
      // Session A: organizations FOR UPDATE first, exactly as manage_organization does.
      await org.query("begin");
      await org.query("select id from organizations where id=$1 for update", [f.org]);
      // Session B: a combo save (items are always reinserted, so FK checks touch organizations).
      await begin(save, f.userId, f.outlet.id);
      const savePid = await pidOf(save);
      const pending = save
        .query("select app_private.tiffin_combo_save($1,$2::jsonb) as r", [
          f.outlet.id,
          JSON.stringify({ ...combo("Raced"), id: existing["id"] }),
        ])
        .then(
          (r) => ({ ok: true as const, r }),
          (e: PgError) => ({ ok: false as const, e })
        );
      await waitUntilBlocked(savePid);
      // Session A continues: UPDATE restaurants (manage_organization's outlet.update shape).
      await org.query(
        "update restaurants set name=name,currency=currency,updated_at=now() where id=$1",
        [f.outlet.id]
      );
      await org.query("commit");
      const outcome = await pending;
      if (!outcome.ok) await save.query("rollback");
      expect(outcome.ok ? null : outcome.e.code).toBeNull();
      await save.query("commit");
    } finally {
      await org.query("rollback").catch(() => undefined);
      org.release();
      save.release();
    }
    const menu = await call(f.userId, f.outlet.id, "tiffin_menu_read");
    expect((menu["combos"] as Json[]).map((c) => c["name"])).toEqual(["Raced"]);
  });

  it("an in-flight combo insert blocks a currency change, which is then rejected (22023)", async () => {
    const f = await tiffinFixture();
    await setMenuCurrency(f.outlet.id, "USD");
    const save = await app.connect();
    const cur = await owner.connect();
    try {
      await begin(save, f.userId, f.outlet.id);
      await save.query("select app_private.tiffin_combo_save($1,$2::jsonb)", [
        f.outlet.id,
        JSON.stringify(combo()),
      ]);
      await cur.query("begin");
      const curPid = await pidOf(cur);
      const pending = cur
        .query("update restaurants set currency='USD' where id=$1", [f.outlet.id])
        .then(
          () => null,
          (e: PgError) => e
        );
      await waitUntilBlocked(curPid);
      await save.query("commit");
      const error = await pending;
      expect(error?.code).toBe("22023");
      expect(error?.message).toBe("Explicit repricing required");
      await cur.query("rollback");
    } finally {
      await save.query("rollback").catch(() => undefined);
      await cur.query("rollback").catch(() => undefined);
      save.release();
      cur.release();
    }
    expect(await stored(f.outlet.id)).toEqual({ outlet: "INR", combos: ["INR"] });
  });

  it("a combo save waiting on an uncommitted currency change stores the new currency", async () => {
    const f = await tiffinFixture();
    await setMenuCurrency(f.outlet.id, "USD");
    const cur = await owner.connect();
    const save = await app.connect();
    try {
      await cur.query("begin");
      await cur.query("update restaurants set currency='USD' where id=$1", [f.outlet.id]);
      await begin(save, f.userId, f.outlet.id);
      const savePid = await pidOf(save);
      const pending = save.query<{ r: Json }>(
        "select app_private.tiffin_combo_save($1,$2::jsonb) as r",
        [f.outlet.id, JSON.stringify(combo())]
      );
      await waitUntilBlocked(savePid);
      await cur.query("commit");
      const saved = (await pending).rows[0]!.r;
      await save.query("commit");
      expect(saved["currency"]).toBe("USD");
    } finally {
      await cur.query("rollback").catch(() => undefined);
      await save.query("rollback").catch(() => undefined);
      cur.release();
      save.release();
    }
    expect(await stored(f.outlet.id)).toEqual({ outlet: "USD", combos: ["USD"] });
  });
});
