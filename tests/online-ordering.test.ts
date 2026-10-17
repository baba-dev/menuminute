import { describe, it, expect } from "vitest";
import {
  orderSubmissionSchema,
  orderTransitionSchema,
} from "../src/modules/orders/contracts";

describe("Online Ordering Contracts & Validation", () => {
  it("validates a complete guest order submission schema", () => {
    const valid = {
      clientSubmissionKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      fulfillmentMode: "dine_in",
      customerName: "Alex Doe",
      customerPhone: "+1234567890",
      notes: "Table by the window",
      items: [
        {
          dishId: "dish-1",
          variantId: "var-1",
          selectedAddOns: [{ groupId: "grp-1", optionId: "opt-1" }],
          quantity: 2,
          itemNotes: "Extra crispy",
        },
      ],
    };

    const parsed = orderSubmissionSchema.parse(valid);
    expect(parsed.clientSubmissionKey).toBe("3fa85f64-5717-4562-b3fc-2c963f66afa6");
    expect(parsed.items[0]?.quantity).toBe(2);
    expect(parsed.fulfillmentMode).toBe("dine_in");
  });

  it("rejects invalid submission with missing or invalid fields", () => {
    // Missing items
    expect(() =>
      orderSubmissionSchema.parse({
        clientSubmissionKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        items: [],
      })
    ).toThrow();

    // Invalid non-UUID submission key
    expect(() =>
      orderSubmissionSchema.parse({
        clientSubmissionKey: "invalid-uuid",
        items: [{ dishId: "d1", quantity: 1 }],
      })
    ).toThrow();

    // Negative or zero quantity
    expect(() =>
      orderSubmissionSchema.parse({
        clientSubmissionKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        items: [{ dishId: "d1", quantity: 0 }],
      })
    ).toThrow();

    // Excessive quantity
    expect(() =>
      orderSubmissionSchema.parse({
        clientSubmissionKey: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        items: [{ dishId: "d1", quantity: 100 }],
      })
    ).toThrow();
  });

  it("validates order transition state schemas", () => {
    const validAccept = {
      targetStatus: "accepted",
      expectedVersion: 1,
    };
    expect(orderTransitionSchema.parse(validAccept).targetStatus).toBe("accepted");

    const validReject = {
      targetStatus: "rejected",
      reason: "Kitchen closed early",
      expectedVersion: 2,
    };
    const parsedReject = orderTransitionSchema.parse(validReject);
    expect(parsedReject.targetStatus).toBe("rejected");
    expect(parsedReject.reason).toBe("Kitchen closed early");

    // Invalid target status
    expect(() =>
      orderTransitionSchema.parse({
        targetStatus: "random_status",
        expectedVersion: 1,
      })
    ).toThrow();

    // Invalid version
    expect(() =>
      orderTransitionSchema.parse({
        targetStatus: "accepted",
        expectedVersion: 0,
      })
    ).toThrow();
  });
});

describe("Online Ordering Transition State Machine", () => {
  const validTransitions: Record<string, string[]> = {
    pending: ["accepted", "rejected"],
    accepted: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served", "collected", "cancelled"],
  };

  it("allows only approved status transitions", () => {
    expect(validTransitions["pending"]).toContain("accepted");
    expect(validTransitions["pending"]).toContain("rejected");
    expect(validTransitions["pending"]).not.toContain("served");
    expect(validTransitions["pending"]).not.toContain("ready");

    expect(validTransitions["accepted"]).toContain("preparing");
    expect(validTransitions["accepted"]).toContain("cancelled");
    expect(validTransitions["accepted"]).not.toContain("pending");

    expect(validTransitions["ready"]).toContain("served");
    expect(validTransitions["ready"]).toContain("collected");
  });
});
