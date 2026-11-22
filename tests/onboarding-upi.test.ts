import { describe, expect, it } from "vitest";
import { admin } from "./helpers";
import { createRestaurantSchema } from "../src/modules/restaurants/service";
import {
  onboardingDraftSchema,
  provisionOnboarding,
  saveOnboarding,
} from "../src/modules/onboarding/service";
import { getOutletReceiptPayment } from "../src/modules/receipt-payment/service";
import { initialWizardDraft } from "../src/components/onboarding/wizard-types";
import { upiStepProblem } from "../src/components/onboarding/upi-step";

const base = {
  name: "Chai Corner",
  country: "IN",
  currency: "INR",
  timezone: "Asia/Kolkata",
  outletType: "restaurant" as const,
  fulfillmentModes: ["dine_in" as const],
  menuSchedule: null,
};

async function verified() {
  const userId = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'UPI test',$2,true)",
      [userId, userId + "@test.invalid"]
    );
  });
  return { userId };
}
async function organizationOf(outletId: string) {
  return admin(async (_, pool) => {
    const row = await pool.query("select organization_id from restaurants where id=$1", [outletId]);
    return row.rows[0].organization_id as string;
  });
}

describe("onboarding draft UPI fields", () => {
  it("accepts blank or valid UPI fields and rejects malformed ones", () => {
    expect(onboardingDraftSchema.safeParse({ upiId: "", upiPayeeName: "" }).success).toBe(true);
    expect(
      onboardingDraftSchema.safeParse({ upiId: "chai@okhdfc", upiPayeeName: "Chai Corner" }).success
    ).toBe(true);
    expect(onboardingDraftSchema.safeParse({ upiId: "not a upi id" }).success).toBe(false);
    expect(onboardingDraftSchema.safeParse({ upiPayeeName: "A" }).success).toBe(false);
  });
  it("is stripped before the outlet is created", () => {
    const parsed = createRestaurantSchema.safeParse({ ...base, upiId: "chai@okhdfc" });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "upiId" in parsed.data).toBe(false);
  });
  it("starts the wizard draft with empty UPI fields", () => {
    expect(initialWizardDraft).toMatchObject({ upiId: "", upiPayeeName: "" });
  });
});

describe("upiStepProblem", () => {
  it("lets the merchant skip the step", () => {
    expect(upiStepProblem({ ...initialWizardDraft })).toBeNull();
  });
  it("accepts a valid pair and flags invalid values", () => {
    expect(
      upiStepProblem({ ...initialWizardDraft, upiId: "chai@okhdfc", upiPayeeName: "Chai Corner" })
    ).toBeNull();
    expect(upiStepProblem({ ...initialWizardDraft, upiId: "chai" })).toMatch(/UPI ID/);
    expect(
      upiStepProblem({ ...initialWizardDraft, upiId: "chai@okhdfc", upiPayeeName: "A" })
    ).toMatch(/payee name/i);
  });
});

describe("provisioning applies the saved UPI profile (real PostgreSQL)", () => {
  it("creates the outlet with an enabled profile, defaulting the payee to the outlet name", async () => {
    const actor = await verified();
    await saveOnboarding(actor, { ...base, upiId: "Chai@OkHDFC", upiPayeeName: "" });
    const { outletId } = (await provisionOnboarding(actor))!;
    const profile = await getOutletReceiptPayment(actor, await organizationOf(outletId), outletId);
    expect(profile).toMatchObject({
      configured: true,
      upiId: "chai@okhdfc",
      payeeName: "Chai Corner",
      enabled: true,
      revision: 1,
    });
  });
  it("leaves the outlet without a profile when the step was skipped", async () => {
    const actor = await verified();
    await saveOnboarding(actor, { ...base, upiId: "", upiPayeeName: "" });
    const { outletId } = (await provisionOnboarding(actor))!;
    const profile = await getOutletReceiptPayment(actor, await organizationOf(outletId), outletId);
    expect(profile).toMatchObject({ configured: false, revision: 0 });
  });
});
