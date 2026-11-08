/**
 * Browser-side Google Play Billing via the Digital Goods API (Chrome in a Trusted Web Activity).
 * Nothing here grants an entitlement: it only collects a purchase token and hands it to the server,
 * which re-queries Google Play before anything is unlocked.
 */
export const PLAY_PAYMENT_METHOD = "https://play.google.com/billing";

interface DigitalGoodsPurchase {
  itemId: string;
  purchaseToken: string;
}
interface DigitalGoodsService {
  listPurchases?: () => Promise<DigitalGoodsPurchase[]>;
}
export interface PlayBillingWindow {
  getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>;
  PaymentRequest?: new (
    methods: { supportedMethods: string; data: Record<string, unknown> }[],
    details: Record<string, unknown>
  ) => {
    show: () => Promise<{
      details: unknown;
      complete: (result?: "success" | "fail" | "unknown") => Promise<void>;
    }>;
  };
}

function browserWindow(): PlayBillingWindow {
  return window as unknown as PlayBillingWindow;
}

/** The purchase sheet exists only when Chrome exposes both APIs, i.e. inside the Play app. */
export function playBillingSupported(w: PlayBillingWindow = browserWindow()): boolean {
  return typeof w.getDigitalGoodsService === "function" && typeof w.PaymentRequest === "function";
}

export class PlayPurchaseCancelled extends Error {
  constructor() {
    super("Purchase cancelled");
  }
}

/** Opens the Google Play purchase sheet for a subscription SKU and returns the purchase token. */
export async function purchaseWithPlay(
  sku: string,
  w: PlayBillingWindow = browserWindow()
): Promise<string> {
  if (!playBillingSupported(w) || !w.PaymentRequest)
    throw new Error("Google Play purchases are not available on this device.");
  const request = new w.PaymentRequest([{ supportedMethods: PLAY_PAYMENT_METHOD, data: { sku } }], {
    total: { label: "Total", amount: { currency: "USD", value: "0" } },
  });
  let response;
  try {
    response = await request.show();
  } catch {
    // Dismissing the sheet rejects the promise; this is not an error condition.
    throw new PlayPurchaseCancelled();
  }
  const token =
    response.details && typeof response.details === "object"
      ? (response.details as { purchaseToken?: unknown }).purchaseToken
      : undefined;
  if (typeof token !== "string" || token.length < 16) {
    await response.complete("fail");
    throw new Error("Google Play did not return a purchase. Please try again.");
  }
  // Completing only closes the payment UI. The server verifies and acknowledges with Google itself.
  await response.complete("success");
  return token;
}

/** Tokens of purchases Google Play still reports for this SKU, for restore after reinstall or a missed callback. */
export async function listPlayPurchaseTokens(
  sku: string,
  w: PlayBillingWindow = browserWindow()
): Promise<string[]> {
  if (!playBillingSupported(w) || !w.getDigitalGoodsService) return [];
  const service = await w.getDigitalGoodsService(PLAY_PAYMENT_METHOD);
  if (typeof service.listPurchases !== "function") return [];
  const purchases = await service.listPurchases();
  return purchases.filter((p) => p.itemId === sku).map((p) => p.purchaseToken);
}
