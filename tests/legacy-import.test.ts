import { it, expect } from "vitest";
import Database from "better-sqlite3";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { importSqlite } from "../scripts/legacy/import-sqlite";
import { migrateDatabase } from "../scripts/migration-runner";
it("imports a read-only legacy snapshot with preserved credentials, QR IDs and totals", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "menuminute-import-"));
  const source = path.join(dir, "source.sqlite");
  const sqlite = new Database(source);
  for (const f of (await readdir("scripts/legacy/sqlite-migrations")).filter((v) =>
    v.endsWith(".sql")
  ))
    sqlite.exec(await readFile(path.join("scripts/legacy/sqlite-migrations", f), "utf8"));
  const password = await bcrypt.hash("legacy-password", 12);
  sqlite
    .prepare(
      "insert into users(id,name,email,password_hash,role) values('source-user','Source Owner','source@test.invalid',?,'user')"
    )
    .run(password);
  sqlite.exec(
    "insert into restaurants(id,public_id,name,slug) values('source-outlet','source-permanent-token','Source Kitchen','source-kitchen'); insert into restaurant_members(id,restaurant_id,user_id,role) values('source-member','source-outlet','source-user','owner'); insert into qr_codes(id,restaurant_id,destination_token) values('source-qr','source-outlet','source-permanent-token'); insert into menu_categories(id,restaurant_id,name) values('source-category','source-outlet','Sample'); insert into menu_items(id,restaurant_id,category_id,name,price_paise) values('source-item','source-outlet','source-category','Dish',125); insert into orders(id,restaurant_id,status,order_number,total_paise) values('source-order','source-outlet','confirmed',1,250);"
  );
  sqlite.close();
  const owner = process.env["MIGRATION_DATABASE_URL"]!;
  const pool = new Pool({ connectionString: owner });
  const name = `menuminute_import_${crypto.randomUUID().replaceAll("-", "")}`;
  const target = new URL(owner);
  target.pathname = `/${name}`;
  try {
    await pool.query(`create database ${name}`);
    await migrateDatabase(target.toString());
    const before = await readFile(source);
    const report = await importSqlite(source, target.toString(), true, {
      "source-outlet": "Asia/Kolkata",
    });
    expect(report.counts.users).toBe(1);
    expect(report.counts.orders).toBe(1);
    expect(await readFile(source)).toEqual(before);
    const verify = new Pool({ connectionString: target.toString() });
    try {
      const q = await verify.query(
        "select r.public_id,a.password,o.total_paise from restaurants r join accounts a on a.user_id='source-user' join orders o on o.restaurant_id=r.id"
      );
      expect(q.rows[0].public_id).toBe("source-permanent-token");
      expect(q.rows[0].total_paise).toBe(250);
      expect(await bcrypt.compare("legacy-password", q.rows[0].password)).toBe(true);
    } finally {
      await verify.end();
    }
    await expect(
      importSqlite(source, target.toString(), true, { "source-outlet": "Asia/Kolkata" })
    ).rejects.toThrow("empty");
    const invalid = new Database(source);
    invalid.pragma("foreign_keys = OFF");
    invalid.exec(
      "insert into restaurant_members(id,restaurant_id,user_id,role) values('orphan-member','missing-outlet','source-user','staff')"
    );
    invalid.close();
    await expect(
      importSqlite(source, target.toString(), true, { "source-outlet": "Asia/Kolkata" })
    ).rejects.toThrow("integrity or foreign keys");
  } finally {
    await pool.query(`drop database if exists ${name} with (force)`);
    await pool.end();
    await rm(dir, { recursive: true, force: true });
  }
}, 30000);
