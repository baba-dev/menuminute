import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { nanoid } from "nanoid";
import { authServer } from "../src/lib/auth";
import { admin } from "./helpers";
import { TERMS_VERSION } from "../src/content/legal";

describe("Community Edition atomic single-owner invariant", () => {
  it("permits only one of two concurrent first-owner inserts", async () => {
    // Test on the isolated PostgreSQL integration database. Only explicit
    // Community Edition registrations ever receive slot 1; hosted users use NULL.
    const ids = [nanoid(), nanoid()];
    const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 2 });
    try {
      const inserts = ids.map((id) =>
        pool.query(
          "INSERT INTO users(id,name,email,community_edition_slot) VALUES($1,'Community Owner',$2,1)",
          [id, `${id}@community.invalid`]
        )
      );
      const results = await Promise.allSettled(inserts);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const failures = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      expect(failures).toHaveLength(1);
      expect(failures[0]!.reason).toMatchObject({
        code: "23505",
        constraint: "users_community_edition_single_owner_idx",
      });
      const rows = await pool.query<{ id: string }>(
        "SELECT id FROM users WHERE community_edition_slot=1 AND id=ANY($1::text[])",
        [ids]
      );
      expect(rows.rows).toHaveLength(1);
    } finally {
      await pool.query("DELETE FROM users WHERE id=ANY($1::text[])", [ids]);
      await pool.end();
    }
  });

  it("blocks alternative slot values at the SQL boundary", async () => {
    const id = nanoid();
    await admin(async (_, pool) => {
      await expect(
        pool.query(
          "INSERT INTO users(id,name,email,community_edition_slot) VALUES($1,'Bypass',$2,2)",
          [id, `${id}@community.invalid`]
        )
      ).rejects.toMatchObject({ code: "23514" });
    });
  });

  it("does not accept a community singleton claim from a hosted signup", async () => {
    const email = `${nanoid()}@signup.invalid`.toLowerCase();
    const response = await authServer.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({
          name: "Hosted Signup",
          email,
          password: "test-password-123",
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date().toISOString(),
          communityEditionSlot: 1, // never a client-controlled authority
        }),
      })
    );
    // Better Auth rejects the unauthorized server-only field (400); it does
    // not persist it or let the caller choose the singleton slot.
    expect(response.status).toBe(400);
    const missing = await admin(async (_, pool) =>
      pool.query("SELECT id FROM users WHERE email=$1", [email])
    );
    expect(missing.rows).toHaveLength(0);

    // Ordinary hosted signup remains fully functional and leaves the slot NULL.
    const valid = await authServer.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json" },
        body: JSON.stringify({
          name: "Hosted Signup",
          email,
          password: "test-password-123",
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date().toISOString(),
        }),
      })
    );
    expect(valid.status).toBe(200);
    await admin(async (_, pool) => {
      const result = await pool.query<{ community_edition_slot: number | null }>(
        "SELECT community_edition_slot FROM users WHERE email=$1",
        [email]
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]!.community_edition_slot).toBeNull();
    });
  });

  it("keeps hosted users unrestricted by the nullable community slot", async () => {
    const ids = [nanoid(), nanoid()];
    await admin(async (_, pool) => {
      try {
        for (const id of ids) {
          await pool.query("INSERT INTO users(id,name,email) VALUES($1,'Hosted',$2)", [
            id,
            `${id}@hosted.invalid`,
          ]);
        }
        const rows = await pool.query<{ community_edition_slot: number | null }>(
          "SELECT community_edition_slot FROM users WHERE id=ANY($1::text[])",
          [ids]
        );
        expect(rows.rows).toHaveLength(2);
        expect(rows.rows.every((row) => row.community_edition_slot === null)).toBe(true);
      } finally {
        await pool.query("DELETE FROM users WHERE id=ANY($1::text[])", [ids]);
      }
    });
  });
});
