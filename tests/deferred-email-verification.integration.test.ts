import { describe, expect, it, vi } from "vitest";
import { admin } from "./helpers";
import { createRestaurant } from "../src/modules/restaurants/service";
import { inviteMember, acceptInvitation } from "../src/modules/onboarding/service";

const details = {
  name: "Unverified Bistro",
  country: "IN",
  currency: "INR",
  timezone: "Asia/Kolkata",
  outletType: "restaurant" as const,
  fulfillmentModes: ["dine_in" as const],
  menuSchedule: null,
};

async function account(verified: boolean) {
  const userId = crypto.randomUUID();
  const email = userId + "@test.invalid";
  await admin(async (_, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Deferred',$2,$3)",
      [userId, email, verified]
    );
  });
  return { userId, email };
}

describe("deferred email verification", () => {
  it("lets a not-yet-verified account provision its first workspace", async () => {
    const actor = await account(false);
    const outlet = await createRestaurant(actor.userId, details);
    expect(outlet.name).toBe("Unverified Bistro");
    // The owner membership exists, so the dashboard is reachable immediately.
    await admin(async (_, pool) => {
      const owner = await pool.query(
        "select role from organization_members where user_id=$1 and organization_id=$2",
        [actor.userId, outlet.organizationId]
      );
      expect(owner.rows[0]?.role).toBe("owner");
    });
  });

  it("keeps the three-owner organization quota for unverified accounts", async () => {
    const actor = await account(false);
    for (let i = 0; i < 3; i++) await createRestaurant(actor.userId, { ...details, name: "Q" + i });
    await expect(createRestaurant(actor.userId, { ...details, name: "Q4" })).rejects.toThrow();
  });

  it("still requires a verified email to issue or accept invitations", async () => {
    const owner = await account(false);
    const outlet = await createRestaurant(owner.userId, details);
    await expect(
      inviteMember({ userId: owner.userId }, outlet.organizationId, {
        email: "teammate@test.invalid",
        role: "member",
        key: crypto.randomUUID(),
      })
    ).rejects.toBeTruthy();
    const stranger = await account(false);
    await expect(
      acceptInvitation({ userId: stranger.userId }, "a".repeat(64))
    ).rejects.toBeTruthy();
  });
});

describe("verified-only request actors", () => {
  async function actorFor(emailVerified: boolean) {
    vi.resetModules();
    vi.doMock("../src/lib/auth", () => ({
      auth: async () => ({
        user: { id: "u1", emailVerified },
        session: { id: "s1" },
      }),
    }));
    const mod = await import("../src/lib/request-context");
    const req = new Request("https://localhost:3000/api/x", {
      method: "POST",
      headers: {
        origin: new URL(process.env["APP_URL"]!).origin,
        "content-type": "application/json",
      },
    });
    return { mod, req };
  }

  it("allows an unverified session for ordinary workspace actions", async () => {
    const { mod, req } = await actorFor(false);
    await expect(mod.requestActor(req, true)).resolves.toMatchObject({ userId: "u1" });
  });

  it("rejects an unverified session for billing and invitation actions", async () => {
    const { mod, req } = await actorFor(false);
    await expect(mod.requestActor(req, true, { verified: true })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("accepts a verified session for verified-only actions", async () => {
    const { mod, req } = await actorFor(true);
    await expect(mod.requestActor(req, true, { verified: true })).resolves.toMatchObject({
      userId: "u1",
    });
  });
});

describe("membership trigger boundary", () => {
  it("refuses to activate an unverified user into an organization that already has members", async () => {
    const owner = await account(true);
    const outlet = await createRestaurant(owner.userId, details);
    const unverified = await account(false);
    await admin(async (_, pool) => {
      await expect(
        pool.query(
          "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'owner')",
          ["m-" + crypto.randomUUID(), outlet.organizationId, unverified.userId]
        )
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        pool.query(
          "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'member')",
          ["m-" + crypto.randomUUID(), outlet.organizationId, unverified.userId]
        )
      ).rejects.toMatchObject({ code: "42501" });
    });
  });
});
