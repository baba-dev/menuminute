import { describe, expect, it, vi } from "vitest";
import { billingState, withEntitledOutlet } from "../src/modules/billing/service";

const state = vi.hoisted(() => ({
  dbCommunity: false,
  appCommunity: false,
  entitlementAllowed: true,
  orgAllowed: true,
}));
vi.mock("@/lib/config/env", () => ({
  env: {
    get COMMUNITY_EDITION() {
      return state.appCommunity;
    },
  },
}));
vi.mock("@/modules/tenancy/service", () => {
  const transaction = () => ({
    execute: vi.fn(async () => ({
      rows: [
        {
          allowed: state.orgAllowed,
          community: state.dbCommunity,
          ordering: state.entitlementAllowed,
          kitchen: state.entitlementAllowed,
        },
      ],
    })),
    select: () => ({
      from: () => ({
        where: () =>
          Object.assign(Promise.resolve([{ organizationId: "org-1" }]), {
            orderBy: () => ({ limit: async () => [] }),
          }),
      }),
    }),
  });
  return {
    withActor: vi.fn(async (_actor, work) => work(transaction())),
    withOutlet: vi.fn(async (_actor, _outlet, _permission, work) => work(transaction())),
  };
});

describe("Billing edition and DB entitlement enforcement", () => {
  const actor = { userId: "user-1", sessionId: "session-1" };
  it("reports effective cloud grants, not hardcoded premium access", async () => {
    state.appCommunity = false;
    state.dbCommunity = false;
    state.entitlementAllowed = false;
    const actual = await billingState(actor, "org-1");
    expect(actual.isCommunityEdition).toBe(false);
    expect(actual.ordering).toBe(false);
    expect(actual.kitchen).toBe(false);
  });
  it("refuses a mismatched application/database edition", async () => {
    state.appCommunity = true;
    state.dbCommunity = false;
    await expect(billingState(actor, "org-1")).rejects.toThrow("Deployment edition mismatch");
  });
  it("shows community capabilities only when database entitlements exist", async () => {
    state.appCommunity = true;
    state.dbCommunity = true;
    state.entitlementAllowed = true;
    const actual = await billingState(actor, "org-1");
    expect(actual.isCommunityEdition).toBe(true);
    expect(actual.ordering).toBe(true);
  });
  it("does not bypass database entitlements for Community Edition work", async () => {
    state.appCommunity = true;
    state.dbCommunity = true;
    state.entitlementAllowed = false;
    await expect(
      withEntitledOutlet(actor, "outlet-1", "orders.accept", "ordering.new", async () => true)
    ).rejects.toThrow("An active entitlement is required");
  });
});
