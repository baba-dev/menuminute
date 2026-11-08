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
    expect(app.ladder.find((c) => c.key === "kitchen_pro")!.note).toMatch(/Google Play/);
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
            { itemId: "menuminute_ordering", purchaseToken: "token-aaaaaaaaaaaaaaaa" },
            { itemId: "something_else", purchaseToken: "token-bbbbbbbbbbbbbbbb" },
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
    const { w, completed } = sheet({ purchaseToken: "tok-1234567890abcdef" });
    expect(playBillingSupported(w)).toBe(true);
    await expect(purchaseWithPlay("menuminute_ordering", w)).resolves.toBe("tok-1234567890abcdef");
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
      "token-aaaaaaaaaaaaaaaa",
    ]);
    await expect(listPlayPurchaseTokens("menuminute_ordering", {})).resolves.toEqual([]);
  });
});
