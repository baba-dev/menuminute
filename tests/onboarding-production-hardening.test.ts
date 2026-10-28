import { expect, it } from "vitest";
import { admin } from "./helpers";
import { createRestaurant, createRestaurantSchema } from "../src/modules/restaurants/service";
import { outletSetupReadiness } from "../src/modules/onboarding/readiness";
import {
  onboardingState,
  saveOnboarding,
  provisionOnboarding,
} from "../src/modules/onboarding/service";

async function verifiedOwner() {
  const userId = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query("insert into users(id,name,email,email_verified) values($1,$2,$3,true)", [
      userId,
      "New owner",
      userId + "@readiness.test",
    ]);
  });
  return { userId };
}

it("new first outlet works with MFA optional, but an empty seeded menu never earns launch credit", async () => {
  const actor = await verifiedOwner();
  const outlet = await createRestaurant(actor.userId, {
    name: "Live Readiness Bakery",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "cafe",
  });
  const org = await admin(async (_, pool) =>
    pool.query<{ mfa_required: boolean }>("select mfa_required from organizations where id=$1", [
      outlet.organizationId,
    ])
  );
  expect(org.rows[0]?.mfa_required).toBe(false);
  const readiness = await outletSetupReadiness(actor, outlet);
  expect(readiness.checks.find((step) => step.id === "outlet")?.complete).toBe(true);
  expect(readiness.checks.find((step) => step.id === "dishes")?.complete).toBe(false);
  expect(readiness.checks.find((step) => step.id === "publish")?.complete).toBe(false);
  expect(readiness.checks.find((step) => step.id === "qr")?.complete).toBe(false);
  expect(readiness.completed).toBe(1);
});

it("rejects unsupported country codes while accepting configured international territories", () => {
  const base = {
    name: "International Kitchen",
    currency: "USD",
    timezone: "UTC",
    outletType: "restaurant",
  };
  expect(createRestaurantSchema.safeParse({ ...base, country: "ZZ" }).success).toBe(false);
  expect(createRestaurantSchema.safeParse({ ...base, country: "AQ" }).success).toBe(true);
});

it("clears private draft data after durable provisioning and does not create a second outlet on replay", async () => {
  const actor = await verifiedOwner();
  const draft = {
    name: "Draft Recovery",
    country: "OM",
    currency: "OMR",
    timezone: "Asia/Muscat",
    outletType: "restaurant" as const,
    operationsContactEmail: "private@owner.test",
  };
  await saveOnboarding(actor, draft);
  const created = await provisionOnboarding(actor);
  expect(created.status).toBe("completed");
  expect(await provisionOnboarding(actor)).toMatchObject({
    status: "completed",
    outletId: created.outletId,
  });
  expect((await onboardingState(actor)).draft).toEqual({});
  const row = await admin(async (_, pool) =>
    pool.query<{ draft: object }>("select draft from onboarding_progress where user_id=$1", [
      actor.userId,
    ])
  );
  expect(row.rows[0]?.draft).toEqual({});
});
