import { it, expect, describe, vi } from "vitest";
import { billingState, withEntitledOutlet } from "../src/modules/billing/service";

// Mock tenancy service
vi.mock("@/modules/tenancy/service", () => ({
  withActor: vi.fn(async (_actor, work) => {
    // Mock successful org admin check
    const mockTx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ allowed: true }] }),
    };
    return work(mockTx);
  }),
  withOutlet: vi.fn(async (_actor, _outletId, _perm, work) => {
    const mockTx = {
      execute: vi.fn().mockResolvedValue({ rows: [{ allowed: true }] }),
    };
    return work(mockTx);
  }),
}));

describe("Billing Dual-Mode (Community Edition vs Cloud)", () => {
  it("grants all capabilities in Community Edition mode", async () => {
    const actor = { userId: "user-123", sessionId: "sess-123" };
    const orgId = "org-test-community";

    const state = await billingState(actor, orgId);
    expect(state.freeMenu).toBe(true);
    expect(state.ordering).toBe(true);
    expect(state.kitchen).toBe(true);
    expect(state.isCommunityEdition).toBe(true);
  });

  it("permits work via withEntitledOutlet in Community Edition without DB entitlement check", async () => {
    const actor = { userId: "user-123", sessionId: "sess-123" };
    let executed = false;

    await withEntitledOutlet(
      actor,
      "outlet-test",
      "orders.accept",
      "ordering.new",
      async () => {
        executed = true;
        return true;
      }
    );

    expect(executed).toBe(true);
  });
});
