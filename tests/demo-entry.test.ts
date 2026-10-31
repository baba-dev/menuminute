import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
import { provisionDemo } from "../src/modules/demo/provision";
import { demoPassword } from "../src/modules/demo/credential";
import { DEMO_IDS } from "../src/modules/demo/ids";

const owner = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"]!, max: 2 });
const secret = process.env["AUTH_SECRET"]!;

describe("demo entry credential", () => {
  beforeAll(async () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "true");
    const c = await owner.connect();
    try {
      await provisionDemo(c, await hashPassword(demoPassword(secret)));
    } finally {
      c.release();
    }
  }, 60000);
  afterAll(async () => {
    vi.unstubAllEnvs();
    await owner.end();
  });

  it("derives a stable, secret-dependent password that is never the public id", () => {
    expect(demoPassword(secret)).toBe(demoPassword(secret));
    expect(demoPassword(secret)).not.toBe(demoPassword(secret + "x"));
    expect(demoPassword(secret)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("signs in through Better Auth without recording events or alerting", async () => {
    const { authServer } = await import("../src/lib/auth");
    const before = (
      await owner.query("select count(*)::int n from auth_security_events where user_id=$1", [
        DEMO_IDS.userId,
      ])
    ).rows[0].n;
    const result = await authServer.api.signInEmail({
      body: { email: DEMO_IDS.userEmail, password: demoPassword(secret), rememberMe: false },
    });
    expect(result.user.id).toBe(DEMO_IDS.userId);
    const session = await owner.query("select 1 from sessions where token=$1 and user_id=$2", [
      result.token,
      DEMO_IDS.userId,
    ]);
    expect(session.rowCount).toBe(1);
    const after = (
      await owner.query("select count(*)::int n from auth_security_events where user_id=$1", [
        DEMO_IDS.userId,
      ])
    ).rows[0].n;
    expect(after).toBe(before);
  });
  it("rejects a wrong password", async () => {
    const { authServer } = await import("../src/lib/auth");
    await expect(
      authServer.api.signInEmail({ body: { email: DEMO_IDS.userEmail, password: "demo-password" } })
    ).rejects.toThrow();
  });
});
