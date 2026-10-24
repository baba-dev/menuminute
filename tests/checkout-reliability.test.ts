import { describe, expect, it } from "vitest";
import { validatePickupInstant } from "../src/modules/orders/service";
import { readPendingGuestOrder } from "../src/modules/orders/guest-checkout";

describe("checkout recovery and pickup scheduling", () => {
  it("restores only a recent pending submission for the same menu", () => {
    const body = {
      token: "menu-one",
      clientSubmissionKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      quotedTotalMinor: 1200,
      fulfillmentMode: "dine_in",
      requestedFulfillmentAt: null,
      customerName: "Guest",
      customerPhone: "",
      notes: "",
      items: [{ dishId: "dish", variantId: null, selectedAddOns: [], quantity: 1, itemNotes: "" }],
    };
    const raw = JSON.stringify({ body, savedAt: Date.now() });
    expect(readPendingGuestOrder(raw, "menu-one")?.clientSubmissionKey).toBe(
      body.clientSubmissionKey
    );
    expect(readPendingGuestOrder(raw, "another-menu")).toBeNull();
    expect(
      readPendingGuestOrder(JSON.stringify({ body, savedAt: Date.now() - 86400001 }), "menu-one")
    ).toBeNull();
  });

  it("validates lead time, advance window and outlet-local slot alignment", () => {
    const now = new Date("2026-10-24T10:00:00.000Z");
    const config = {
      now,
      timezone: "Asia/Kolkata",
      leadMinutes: 15,
      slotMinutes: 15,
      advanceDays: 7,
    };
    expect(
      validatePickupInstant({ ...config, value: "2026-10-24T10:30:00.000Z" }).toISOString()
    ).toBe("2026-10-24T10:30:00.000Z");
    expect(() => validatePickupInstant({ ...config, value: "2026-10-24T10:05:00.000Z" })).toThrow(
      /preparation/
    );
    expect(() => validatePickupInstant({ ...config, value: "2026-10-24T10:22:00.000Z" })).toThrow(
      /15-minute/
    );
    expect(() => validatePickupInstant({ ...config, value: "2026-11-02T10:30:00.000Z" })).toThrow(
      /7 days/
    );
  });
});
