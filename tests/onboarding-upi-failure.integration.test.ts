import { expect, it, vi } from "vitest";
import { admin } from "./helpers";
import { provisionOnboarding, saveOnboarding } from "../src/modules/onboarding/service";

vi.mock("@/modules/receipt-payment/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/modules/receipt-payment/service")>()),
  saveOutletReceiptPayment: vi.fn().mockRejectedValue(new Error("profile store unavailable")),
}));

it("still creates the outlet when saving the UPI profile fails", async () => {
  const userId = crypto.randomUUID();
  await admin(async (_, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'UPI fail',$2,true)",
      [userId, userId + "@test.invalid"]
    );
  });
  const actor = { userId };
  await saveOnboarding(actor, {
    name: "Resilient Kitchen",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
    fulfillmentModes: ["dine_in"],
    menuSchedule: null,
    upiId: "chai@okhdfc",
    upiPayeeName: "Resilient",
  });
  const result = await provisionOnboarding(actor);
  expect(result).toMatchObject({ status: "completed" });
  await admin(async (_, pool) => {
    const outlets = await pool.query("select 1 from restaurants where id=$1", [result!.outletId]);
    expect(outlets.rowCount).toBe(1);
    const profiles = await pool.query(
      "select 1 from app_private.outlet_receipt_payment_profiles where outlet_id=$1",
      [result!.outletId]
    );
    expect(profiles.rowCount).toBe(0);
  });
});
