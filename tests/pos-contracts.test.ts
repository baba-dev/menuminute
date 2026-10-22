import { describe, expect, it } from "vitest";
import {
  posAttachSchema,
  posSubmissionSchema,
  sellerSettingsSchema,
} from "../src/modules/pos/service";

describe("POS A/C strict financial contracts", () => {
  const validSelection = {
    menuId: "published",
    expectedRevision: 2,
    lines: [
      {
        dishId: "plate",
        variantId: null,
        groups: [{ groupId: "extras", optionIds: ["bread"] }],
        quantity: 1,
      },
    ],
  };
  it("accepts an explicit pre-tax staff command without browser prices", () => {
    const parsed = posSubmissionSchema.parse({
      key: "00000000-0000-4000-8000-000000000001",
      selection: validSelection,
      fulfillmentMode: "pickup",
      tableId: null,
      expectedSubtotalMinor: "14000",
    });
    expect(parsed.selection.lines[0]?.dishId).toBe("plate");
    expect(parsed.customerName).toBe("");
    expect("taxMinor" in parsed).toBe(false);
  });
  it("rejects bad keys, negative money, unknown financial fields and quantity overflow", () => {
    const valid = {
      key: "00000000-0000-4000-8000-000000000001",
      selection: validSelection,
      fulfillmentMode: "pickup",
      tableId: null,
      expectedSubtotalMinor: "14000",
    };
    expect(() => posSubmissionSchema.parse({ ...valid, key: "not-uuid" })).toThrow();
    expect(() => posSubmissionSchema.parse({ ...valid, expectedSubtotalMinor: "-100" })).toThrow();
    expect(() => posSubmissionSchema.parse({ ...valid, paymentMethod: "cash" })).toThrow();
    expect(() =>
      posSubmissionSchema.parse({
        ...valid,
        selection: { ...validSelection, lines: [{ ...validSelection.lines[0], quantity: 0 }] },
      })
    ).toThrow();
    expect(() =>
      posAttachSchema.parse({ key: valid.key, orderId: "ord-123", status: "paid" })
    ).toThrow();
  });
  it("requires real seller identity before opt-in without asserting tax registration", () => {
    const profile = {
      expectedRevision: 0,
      enabled: true,
      legalName: "Example Restaurant",
      registeredAddress: "Example registered address",
      country: "IN",
      taxRegime: "unconfigured",
      taxRegistration: null,
    };
    expect(sellerSettingsSchema.parse(profile).taxRegime).toBe("unconfigured");
    expect(() => sellerSettingsSchema.parse({ ...profile, country: "India" })).toThrow();
    expect(() => sellerSettingsSchema.parse({ ...profile, legalName: " " })).toThrow();
    expect(() => sellerSettingsSchema.parse({ ...profile, invoiceIssued: true })).toThrow();
  });
});
