import { describe, expect, it } from "vitest";
import { Pool } from "pg";

const url = process.env["DATABASE_URL"];
if (!url || new URL(url).pathname !== "/menuminute_test")
  throw new Error("Isolated menuminute_test database required");

describe("Billing security boundary (real PostgreSQL)", () => {
  const appPool = new Pool({ connectionString: url, max: 1 });
  const chargeSignature =
    "app_private.record_razorpay_charge(text,text,text,text,timestamptz,timestamptz,timestamptz)";
  it("cannot directly execute the privileged paid-entitlement function", async () => {
    const { rows } = await appPool.query<{ permitted: boolean }>(
      "SELECT has_function_privilege(current_user,$1,'EXECUTE') AS permitted",
      [chargeSignature]
    );
    expect(rows[0]?.permitted).toBe(false);
  });
  it("cannot read or update private provider subscription records", async () => {
    const { rows } = await appPool.query<{ permitted: boolean }>(
      "SELECT has_table_privilege(current_user,'app_private.razorpay_subscriptions','SELECT') AS permitted"
    );
    expect(rows[0]?.permitted).toBe(false);
    await expect(
      appPool.query("UPDATE app_private.deployment_edition SET edition='community' WHERE singleton")
    ).rejects.toThrow();
  });
  it("starts with cloud-mode database authority, not silently unlocked premium", async () => {
    const { rows } = await appPool.query<{ community: boolean }>(
      "SELECT app_private.is_community_edition() AS community"
    );
    expect(rows[0]?.community).toBe(false);
  });
  it("closes cleanly", async () => {
    await appPool.end();
  });
});
