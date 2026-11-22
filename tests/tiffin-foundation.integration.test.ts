import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";
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
      await expect(insertSlot(pool, org, f.outlet.id, "lunch")).rejects.toThrow(/unique/i);
      await insertSlot(pool, org, f.outlet.id, "dinner");
      await expect(insertSlot(pool, org, f.outlet.id, "breakfast")).rejects.toThrow(/check/i);
      const bad = [
        [720, 720, 0, null],
        [-1, 60, 0, null],
        [0, 1441, 0, null],
        [600, 700, 10081, null],
        [600, 700, 0, 0],
      ];
      for (const [start, end, cutoff, capacity] of bad) {
        await expect(
          pool.query(
            `insert into tiffin_slots(organization_id,outlet_id,kind,start_minute,end_minute,cutoff_minutes_before,capacity)
             values($1,$2,'lunch',$3,$4,$5,$6)`,
            [org, f.outlet.id, start, end, cutoff, capacity]
          )
        ).rejects.toThrow(/check/i);
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
