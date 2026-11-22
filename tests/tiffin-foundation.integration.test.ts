import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";
import { listOrganizations, manageOrganization } from "../src/modules/organizations/service";
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

async function asApp<T>(work: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

async function asRole<T>(envName: string, work: (pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env[envName], max: 1 });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}

/** Asserts a PostgreSQL rejection by SQLSTATE and, when given, constraint name. */
async function expectPg(work: Promise<unknown>, code: string, constraint?: string | string[]) {
  let error: { code?: string; constraint?: string } | undefined;
  try {
    await work;
  } catch (e) {
    error = e as { code?: string; constraint?: string };
  }
  expect(error, "expected the statement to be rejected").toBeDefined();
  expect(error!.code).toBe(code);
  if (constraint) expect([constraint].flat()).toContain(error!.constraint);
}

async function insertSlot(pool: Pool, orgId: string, outletId: string, kind = "lunch") {
  const r = await pool.query<{ id: string }>(
    `insert into tiffin_slots(organization_id,outlet_id,kind,start_minute,end_minute,cutoff_minutes_before)
     values($1,$2,$3,720,840,120) returning id`,
    [orgId, outletId, kind]
  );
  return r.rows[0]!.id;
}

async function insertCombo(pool: Pool, orgId: string, outletId: string, priceMinor = 9000) {
  const r = await pool.query<{ id: string }>(
    `insert into tiffin_combos(organization_id,outlet_id,name,price_minor,currency)
     values($1,$2,'Veg thali',$3,'INR') returning id`,
    [orgId, outletId, priceMinor]
  );
  return r.rows[0]!.id;
}

describe("tiffin foundation migration 0114 — tenant isolation and constraints", () => {
  it("creates every tiffin table with row level security enabled", async () => {
    await admin(async (_db, pool) => {
      const r = await pool.query<{ relname: string; relrowsecurity: boolean }>(
        "select relname,relrowsecurity from pg_class where relkind='r' and relname = any($1::text[])",
        [TIFFIN_TABLES]
      );
      expect(r.rows.map((row) => row.relname).sort()).toEqual([...TIFFIN_TABLES].sort());
      expect(r.rows.every((row) => row.relrowsecurity)).toBe(true);
    });
  });

  it("closes direct table access for the app role", async () => {
    for (const table of TIFFIN_TABLES) {
      await asApp(async (pool) => {
        await expect(pool.query(`select 1 from ${table}`)).rejects.toThrow(/permission denied/);
      });
    }
    const f = await fixture();
    await asApp(async (pool) => {
      await expect(insertSlot(pool, f.outlet.organizationId, f.outlet.id)).rejects.toThrow(
        /permission denied/
      );
    });
  });

  it("accepts the tiffin outlet type and still rejects unknown types", async () => {
    const f = await fixture();
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set outlet_type='tiffin' where id=$1", [f.outlet.id]);
      const r = await pool.query<{ outlet_type: string }>(
        "select outlet_type from restaurants where id=$1",
        [f.outlet.id]
      );
      expect(r.rows[0]?.outlet_type).toBe("tiffin");
      await expect(
        pool.query("update restaurants set outlet_type='bogus' where id=$1", [f.outlet.id])
      ).rejects.toThrow(/outlet_type_valid/);
    });
  });

  it("rejects cross-organization references through composite foreign keys", async () => {
    const a = await fixture();
    const b = await fixture();
    await admin(async (_db, pool) => {
      // A combo owned by org A must not point at an outlet of org B.
      await expect(insertCombo(pool, a.outlet.organizationId, b.outlet.id)).rejects.toThrow(
        /foreign key/
      );
      // A week menu of org A must not point at a slot of org B.
      const slotB = await insertSlot(pool, b.outlet.organizationId, b.outlet.id);
      await expect(
        pool.query(
          `insert into tiffin_week_menus(organization_id,outlet_id,slot_id,weekday) values($1,$2,$3,1)`,
          [a.outlet.organizationId, a.outlet.id, slotB]
        )
      ).rejects.toThrow(/foreign key/);
      // A combo item of org A must not point at a combo of org B.
      const comboB = await insertCombo(pool, b.outlet.organizationId, b.outlet.id);
      await expect(
        pool.query(
          `insert into tiffin_combo_items(organization_id,outlet_id,combo_id,label,quantity)
           values($1,$2,$3,'Roti',4)`,
          [a.outlet.organizationId, a.outlet.id, comboB]
        )
      ).rejects.toThrow(/foreign key/);
      // A week-menu join row must not link org A's menu to org B's combo.
      const slotA = await insertSlot(pool, a.outlet.organizationId, a.outlet.id);
      const menuA = await pool.query<{ id: string }>(
        `insert into tiffin_week_menus(organization_id,outlet_id,slot_id,weekday)
         values($1,$2,$3,1) returning id`,
        [a.outlet.organizationId, a.outlet.id, slotA]
      );
      await expect(
        pool.query(
          `insert into tiffin_week_menu_combos(organization_id,outlet_id,week_menu_id,combo_id)
           values($1,$2,$3,$4)`,
          [a.outlet.organizationId, a.outlet.id, menuA.rows[0]!.id, comboB]
        )
      ).rejects.toThrow(/foreign key/);
      // A same-organization, same-outlet link is accepted.
      const comboA = await insertCombo(pool, a.outlet.organizationId, a.outlet.id);
      await pool.query(
        `insert into tiffin_week_menu_combos(organization_id,outlet_id,week_menu_id,combo_id)
         values($1,$2,$3,$4)`,
        [a.outlet.organizationId, a.outlet.id, menuA.rows[0]!.id, comboA]
      );
    });
  });

  it("allows one slot per kind per outlet and enforces the slot window bounds", async () => {
    const f = await fixture();
    const org = f.outlet.organizationId;
    await admin(async (_db, pool) => {
      await insertSlot(pool, org, f.outlet.id, "lunch");
      await expectPg(
        insertSlot(pool, org, f.outlet.id, "lunch"),
        "23505",
        "tiffin_slots_outlet_kind_key"
      );
      await insertSlot(pool, org, f.outlet.id, "dinner");
      await expectPg(
        insertSlot(pool, org, f.outlet.id, "breakfast"),
        "23514",
        "tiffin_slots_kind_check"
      );
      const bad = [
        [720, 720, 0, null],
        [-1, 60, 0, null],
        [0, 1441, 0, null],
        [600, 700, 10081, null],
        [600, 700, 0, 0],
      ];
      for (const [start, end, cutoff, capacity] of bad) {
        await expectPg(
          pool.query(
            `insert into tiffin_slots(organization_id,outlet_id,kind,start_minute,end_minute,cutoff_minutes_before,capacity)
             values($1,$2,'lunch',$3,$4,$5,$6)`,
            [org, f.outlet.id, start, end, cutoff, capacity]
          ),
          "23514"
        );
      }
    });
  });

  it("rejects negative or out-of-range money and invalid text bounds", async () => {
    const f = await fixture();
    const org = f.outlet.organizationId;
    await admin(async (_db, pool) => {
      await expect(insertCombo(pool, org, f.outlet.id, -1)).rejects.toThrow(/check/i);
      await expect(insertCombo(pool, org, f.outlet.id, 2147483648)).rejects.toThrow(/check/i);
      const combo = await insertCombo(pool, org, f.outlet.id, 2147483647);
      await expect(
        pool.query(
          `insert into tiffin_combo_addons(organization_id,outlet_id,combo_id,label,price_minor)
           values($1,$2,$3,'Extra roti',-1)`,
          [org, f.outlet.id, combo]
        )
      ).rejects.toThrow(/check/i);
      await expect(
        pool.query(
          `insert into tiffin_combo_items(organization_id,outlet_id,combo_id,label,quantity)
           values($1,$2,$3,'Roti',100)`,
          [org, f.outlet.id, combo]
        )
      ).rejects.toThrow(/check/i);
      await pool.query(
        `insert into tiffin_areas(organization_id,outlet_id,name) values($1,$2,$3)`,
        [org, f.outlet.id, "Koramangala"]
      );
      await expect(
        pool.query(`insert into tiffin_areas(organization_id,outlet_id,name) values($1,$2,$3)`, [
          org,
          f.outlet.id,
          "KORAMANGALA",
        ])
      ).rejects.toThrow(/unique/i);
      await expect(
        pool.query(`insert into tiffin_areas(organization_id,outlet_id,name) values($1,$2,$3)`, [
          org,
          f.outlet.id,
          "x".repeat(61),
        ])
      ).rejects.toThrow(/check/i);
    });
  });

  it("is applied once: a second migrateDatabase leaves the ledger equal to the journal", async () => {
    await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]!);
    await migrateDatabase(process.env["MIGRATION_DATABASE_URL"]!);
    await admin(async (_db, pool) => {
      const journal = JSON.parse(
        await readFile("src/db/migrations/meta/_journal.json", "utf8")
      ) as { entries: { tag: string }[] };
      expect(journal.entries.map((e) => e.tag)).toContain("0114_tiffin_foundation");
      const names = (
        await pool.query<{ name: string }>("select name from drizzle.foundation_migrations")
      ).rows.map((row) => row.name);
      expect(names.sort()).toEqual(journal.entries.map((e) => e.tag).sort());
    });
  });
});

type Parents = Record<string, string>;
type Built = { sql: string; params: unknown[] };
type TableSpec = {
  table: string;
  /** Parent key -> foreign key constraint suffix on this table. */
  parents: Record<string, string>;
  build: (org: string, outlet: string, p: Parents, variant: number) => Built;
  returnsId: boolean;
};
const day = (variant: number) => `2031-01-${String(10 + variant).padStart(2, "0")}`;
const SPECS: TableSpec[] = [
  {
    table: "tiffin_slots",
    parents: {},
    returnsId: true,
    build: (org, outlet, _p, v) => ({
      sql: `insert into tiffin_slots(organization_id,outlet_id,kind,start_minute,end_minute,cutoff_minutes_before)
            values($1,$2,$3,720,840,120) returning id`,
      params: [org, outlet, v === 0 ? "lunch" : "dinner"],
    }),
  },
  {
    table: "tiffin_combos",
    parents: {},
    returnsId: true,
    build: (org, outlet, _p, v) => ({
      sql: `insert into tiffin_combos(organization_id,outlet_id,name,price_minor,currency)
            values($1,$2,$3,9000,'INR') returning id`,
      params: [org, outlet, `Thali ${v}`],
    }),
  },
  {
    table: "tiffin_combo_items",
    parents: { combo: "combo_fkey" },
    returnsId: true,
    build: (org, outlet, p) => ({
      sql: `insert into tiffin_combo_items(organization_id,outlet_id,combo_id,label,quantity)
            values($1,$2,$3,'Roti',4) returning id`,
      params: [org, outlet, p["combo"]],
    }),
  },
  {
    table: "tiffin_combo_addons",
    parents: { combo: "combo_fkey" },
    returnsId: true,
    build: (org, outlet, p) => ({
      sql: `insert into tiffin_combo_addons(organization_id,outlet_id,combo_id,label,price_minor)
            values($1,$2,$3,'Extra roti',1000) returning id`,
      params: [org, outlet, p["combo"]],
    }),
  },
  {
    table: "tiffin_week_menus",
    parents: { slot: "slot_fkey" },
    returnsId: true,
    build: (org, outlet, p, v) => ({
      sql: `insert into tiffin_week_menus(organization_id,outlet_id,slot_id,weekday)
            values($1,$2,$3,$4) returning id`,
      params: [org, outlet, p["slot"], v + 1],
    }),
  },
  {
    table: "tiffin_week_menu_combos",
    parents: { menu: "menu_fkey", combo: "combo_fkey" },
    returnsId: false,
    build: (org, outlet, p) => ({
      sql: `insert into tiffin_week_menu_combos(organization_id,outlet_id,week_menu_id,combo_id)
            values($1,$2,$3,$4)`,
      params: [org, outlet, p["menu"], p["combo"]],
    }),
  },
  {
    table: "tiffin_date_overrides",
    parents: { slot: "slot_fkey" },
    returnsId: true,
    build: (org, outlet, p, v) => ({
      sql: `insert into tiffin_date_overrides(organization_id,outlet_id,slot_id,local_date)
            values($1,$2,$3,$4) returning id`,
      params: [org, outlet, p["slot"], day(v)],
    }),
  },
  {
    table: "tiffin_date_override_combos",
    parents: { override: "override_fkey", combo: "combo_fkey" },
    returnsId: false,
    build: (org, outlet, p) => ({
      sql: `insert into tiffin_date_override_combos(organization_id,outlet_id,override_id,combo_id)
            values($1,$2,$3,$4)`,
      params: [org, outlet, p["override"], p["combo"]],
    }),
  },
  {
    table: "tiffin_areas",
    parents: {},
    returnsId: true,
    build: (org, outlet, _p, v) => ({
      sql: `insert into tiffin_areas(organization_id,outlet_id,name) values($1,$2,$3) returning id`,
      params: [org, outlet, `Area ${v}`],
    }),
  },
];
// Parent key -> the spec that creates it.
const PARENT_SOURCE: Record<string, string> = {
  combo: "tiffin_combos",
  slot: "tiffin_slots",
  menu: "tiffin_week_menus",
  override: "tiffin_date_overrides",
};

describe("tiffin foundation migration 0114 - isolation across all nine tables", () => {
  async function world() {
    const a = await fixture();
    const b = await fixture();
    const orgA = a.outlet.organizationId;
    const version = (await listOrganizations(a.actor))[0]!.version;
    const second = await manageOrganization(a.actor, orgA, {
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
    return {
      orgA,
      orgB: b.outlet.organizationId,
      a1: a.outlet.id,
      a2: String(second.outletId),
      b1: b.outlet.id,
    };
  }

  async function parentsFor(pool: Pool, org: string, outlet: string) {
    const out: Parents = {};
    // Order matters: week menus and overrides need a slot.
    for (const key of ["slot", "combo", "menu", "override"]) {
      const spec = SPECS.find((x) => x.table === PARENT_SOURCE[key])!;
      const q = spec.build(org, outlet, out, 0);
      out[key] = (await pool.query<{ id: string }>(q.sql, q.params)).rows[0]!.id;
    }
    return out;
  }

  it("rejects cross-organization and cross-outlet references on every table with pinned errors", async () => {
    const w = await world();
    await admin(async (_db, pool) => {
      const pa1 = await parentsFor(pool, w.orgA, w.a1);
      const pa2 = await parentsFor(pool, w.orgA, w.a2);
      const pb1 = await parentsFor(pool, w.orgB, w.b1);
      for (const spec of SPECS) {
        const fkeys = Object.entries(spec.parents).map(([, name]) => `${spec.table}_${name}`);
        const outletFkey = `${spec.table}_outlet_fkey`;
        // (a) org A row that points at an org B outlet (with org B's own parents).
        const crossOrg = spec.build(w.orgA, w.b1, pb1, 1);
        await expectPg(pool.query(crossOrg.sql, crossOrg.params), "23503", [outletFkey, ...fkeys]);
        for (const [key, name] of Object.entries(spec.parents)) {
          const constraint = `${spec.table}_${name}`;
          // (a) org A / outlet A1 row whose parent belongs to org B.
          const foreignParent = spec.build(w.orgA, w.a1, { ...pa1, [key]: pb1[key]! }, 1);
          await expectPg(pool.query(foreignParent.sql, foreignParent.params), "23503", constraint);
          // (b) same org, outlet A1 row whose parent belongs to outlet A2.
          const siblingParent = spec.build(w.orgA, w.a1, { ...pa1, [key]: pa2[key]! }, 1);
          await expectPg(pool.query(siblingParent.sql, siblingParent.params), "23503", constraint);
          // (b) mirrored: outlet A2 row whose parent belongs to outlet A1.
          const mirrored = spec.build(w.orgA, w.a2, { ...pa2, [key]: pa1[key]! }, 1);
          await expectPg(pool.query(mirrored.sql, mirrored.params), "23503", constraint);
        }
        // An outlet of another organization is rejected for parentless tables by the outlet key.
        if (!fkeys.length) {
          const crossOutlet = spec.build(w.orgB, w.a1, pa1, 1);
          await expectPg(pool.query(crossOutlet.sql, crossOutlet.params), "23503", outletFkey);
        }
        // Positive control last: the same shape with matching ownership is accepted.
        const ok = spec.build(w.orgA, w.a1, pa1, 1);
        await pool.query(ok.sql, ok.params);
      }
    });
  });

  it("denies SELECT and INSERT on every table to both the app and worker roles", async () => {
    const w = await world();
    const parents = await admin(async (_db, pool) => parentsFor(pool, w.orgA, w.a1));
    for (const role of ["DATABASE_URL", "WORKER_DATABASE_URL"]) {
      await asRole(role, async (pool) => {
        for (const spec of SPECS) {
          await expectPg(pool.query(`select 1 from ${spec.table}`), "42501");
          const q = spec.build(w.orgA, w.a1, parents, 3);
          await expectPg(pool.query(q.sql, q.params), "42501");
        }
      });
    }
  });
});
