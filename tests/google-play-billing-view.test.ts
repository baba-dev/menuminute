import { describe, expect, it } from "vitest";
import { buildBillingPageView, coercePlaySubscriptions } from "../src/modules/plans/billing-page";
import {
  listPlayPurchaseTokens,
  playBillingSupported,
  PlayPurchaseCancelled,
  purchaseWithPlay,
  PLAY_PAYMENT_METHOD,
  type PlayBillingWindow,
} from "../src/lib/play-billing-client";

// Generated at runtime so no token-shaped literal is committed.
const fresh = () => `t${crypto.randomUUID().replaceAll("-", "")}`;
const tokenA = fresh();
const tokenB = fresh();
const tokenC = fresh();
const now = new Date("2026-11-08T00:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const base = {
  organizationName: "Saffron",
  intake: null,
  usage: null,
  canManage: true,
  now,
};
const billing = (over: Record<string, unknown> = {}) => ({
  billingEnabled: true,
  playBillingEnabled: true,
  playKitchenEnabled: false,
  playSkus: { ordering: "menuminute_ordering", kitchen_pro: "menuminute_kitchen_pro" },
  kitchenCommerceEnabled: false,
  subscriptions: [],
  playSubscriptions: [],
  grants: [],
  ...over,
});

describe("billing page in the Play app", () => {
  it("offers Google Play Billing for Ordering and never Razorpay checkout", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "free",
      billing: billing(),
      playClient: true,
    });
    const ordering = view.ladder.find((c) => c.key === "ordering")!;
    expect(ordering.action).toMatchObject({ kind: "play-checkout", plan: "ordering" });
    expect(view.ladder.some((c) => c.action?.kind === "checkout")).toBe(false);
    const kitchen = view.ladder.find((c) => c.key === "kitchen_pro")!;
    expect(kitchen.action).toBeNull();
    expect(kitchen.note).toMatch(/not available in the Android app/);
    expect(view.checkoutAvailable).toBe(true);
    expect(view.playSkus).toEqual(["menuminute_ordering", "menuminute_kitchen_pro"]);
  });
  it("sells Kitchen Pro through Play when enabled, and offers it as the upgrade from a live Play Ordering plan", () => {
    const playSubscriptions = coercePlaySubscriptions([
      { product: "ordering", state: "active", currentPeriodEnd: inDays(12), autoRenewing: true },
    ]);
    const view = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({ playKitchenEnabled: true, playSubscriptions }),
      playClient: true,
    });
    const kitchen = view.ladder.find((c) => c.key === "kitchen_pro")!;
    expect(kitchen.action).toMatchObject({ kind: "play-checkout", plan: "kitchen_pro" });
    expect(kitchen.switchNote).toMatch(/stops renewing/);
    expect(view.checkoutAvailable).toBe(true);
    // The web never offers it while Play is billing.
    const web = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({ playKitchenEnabled: true, playSubscriptions }),
    });
    expect(web.ladder.find((c) => c.key === "kitchen_pro")!.action).toBeNull();
  });
  it("offers nothing further once Kitchen Pro is live on Play", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "kitchen_pro",
      billing: billing({
        playKitchenEnabled: true,
        playSubscriptions: coercePlaySubscriptions([
          {
            product: "kitchen_pro",
            state: "active",
            currentPeriodEnd: inDays(20),
            autoRenewing: true,
          },
        ]),
      }),
      playClient: true,
    });
    expect(view.ladder.every((c) => c.action === null || c.action.kind === "contact")).toBe(true);
    expect(view.subscriptions[0]).toMatchObject({ product: "Kitchen Pro", provider: "play" });
  });
  it("offers nothing when Play billing is not configured, even if Razorpay is on", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "free",
      billing: billing({ playBillingEnabled: false }),
      playClient: true,
    });
    expect(view.ladder.every((c) => c.action === null || c.action.kind === "contact")).toBe(true);
    expect(view.checkoutAvailable).toBe(false);
    expect(view.playSkus).toBeNull();
  });
  it("hides Razorpay subscriptions from the Play app so they cannot be cancelled or paid there", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({
        subscriptions: [
          {
            subscriptionId: "sub_ABC123456",
            product: "ordering",
            status: "active",
            currentPeriodEnd: inDays(10),
          },
        ],
      }),
      playClient: true,
    });
    expect(view.subscriptions).toEqual([]);
  });
  it("shows a live Play subscription with a Google Play manage link, and blocks web checkout", () => {
    const playSubscriptions = coercePlaySubscriptions([
      { product: "ordering", state: "active", currentPeriodEnd: inDays(20), autoRenewing: true },
    ]);
    const web = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({ playSubscriptions }),
    });
    expect(web.checkoutAvailable).toBe(false);
    expect(web.ladder.find((c) => c.key === "ordering")!.action).toBeNull();
    expect(web.cycle.payment).toBe("Managed by Google Play");
    const row = web.subscriptions[0]!;
    expect(row).toMatchObject({ provider: "play", canCancel: false });
    expect(row.manageUrl).toBe("https://play.google.com/store/account/subscriptions");

    const app = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({ playSubscriptions }),
      playClient: true,
    });
    expect(app.ladder.find((c) => c.key === "kitchen_pro")!.note).toMatch(
      /not available in the Android app/
    );
    expect(web.ladder.find((c) => c.key === "kitchen_pro")!.note).toMatch(/Google Play/);
  });
  it("reports renewal-off Play subscriptions as ending, and ignores malformed rows", () => {
    const view = buildBillingPageView({
      ...base,
      plan: "ordering",
      billing: billing({
        playSubscriptions: coercePlaySubscriptions([
          {
            product: "ordering",
            state: "canceled",
            currentPeriodEnd: inDays(5),
            autoRenewing: false,
          },
          { state: "active" },
          null,
        ]),
      }),
      playClient: true,
    });
    expect(view.cycle.headline).toMatch(/^Ends /);
    expect(view.subscriptions).toHaveLength(1);
    expect(view.subscriptions[0]!.cancelScheduled).toBe(true);
  });
  it("leaves the web experience unchanged when Play is not involved", () => {
    const view = buildBillingPageView({ ...base, plan: "free", billing: billing() });
    expect(view.ladder.find((c) => c.key === "ordering")!.action).toMatchObject({
      kind: "checkout",
    });
    expect(view.playClient).toBe(false);
  });
});

describe("Digital Goods client", () => {
  const sheet = (details: unknown, fail = false) => {
    const completed: string[] = [];
    class FakeRequest {
      constructor(
        public methods: { supportedMethods: string; data: Record<string, unknown> }[],
        public details: Record<string, unknown>
      ) {
        sheet.last = { methods, details };
      }
      async show() {
        if (fail) throw new Error("AbortError");
        return { details, complete: async (r?: string) => void completed.push(r ?? "") };
      }
    }
    return {
      completed,
      w: {
        getDigitalGoodsService: async () => ({
          listPurchases: async () => [
            { itemId: "menuminute_ordering", purchaseToken: tokenA },
            { itemId: "something_else", purchaseToken: tokenB },
          ],
        }),
        PaymentRequest: FakeRequest,
      } as unknown as PlayBillingWindow,
    };
  };
  sheet.last = undefined as unknown;

  it("is unsupported without the Digital Goods API (e.g. a normal browser)", () => {
    expect(playBillingSupported({})).toBe(false);
  });
  it("requests the SKU through the Play payment method and returns the token", async () => {
    const { w, completed } = sheet({ purchaseToken: tokenC });
    expect(playBillingSupported(w)).toBe(true);
    await expect(purchaseWithPlay("menuminute_ordering", w)).resolves.toBe(tokenC);
    expect(completed).toEqual(["success"]);
    expect(sheet.last).toMatchObject({
      methods: [{ supportedMethods: PLAY_PAYMENT_METHOD, data: { sku: "menuminute_ordering" } }],
    });
  });
  it("treats a dismissed sheet as a cancellation and a tokenless response as a failure", async () => {
    await expect(purchaseWithPlay("menuminute_ordering", sheet({}, true).w)).rejects.toBeInstanceOf(
      PlayPurchaseCancelled
    );
    const bad = sheet({});
    await expect(purchaseWithPlay("menuminute_ordering", bad.w)).rejects.toThrow(/did not return/);
    expect(bad.completed).toEqual(["fail"]);
  });
  it("lists only tokens for the requested SKU for restore", async () => {
    await expect(listPlayPurchaseTokens("menuminute_ordering", sheet({}).w)).resolves.toEqual([
      tokenA,
    ]);
    await expect(listPlayPurchaseTokens("menuminute_ordering", {})).resolves.toEqual([]);
  });
});
