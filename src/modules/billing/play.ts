import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/errors";
import { billingQuery } from "@/modules/billing/razorpay";

/**
 * Google Play Billing server integration.
 *
 * Trust model: nothing a client or a Pub/Sub message says is believed. The purchase token is only a
 * lookup key; every entitlement change is made from a fresh `purchases.subscriptionsv2.get` response
 * fetched with our own service account, and written by the restricted billing database identity.
 */

export const PLAY_ANDROID_PUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const PUBLISHER_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const TOKEN_PATTERN = /^[A-Za-z0-9._\-~+/=]{16,4096}$/;

export type PlayProduct = "ordering";
export type PlayState =
  "pending" | "active" | "canceled" | "grace" | "on_hold" | "paused" | "expired" | "revoked";

export function isPlausiblePurchaseToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

/** Launch scope is Ordering only; Kitchen Pro stays Razorpay-only (see migration 0111). */
export function playCatalog() {
  return {
    ordering: {
      product: "ordering" as const,
      sku: env.GOOGLE_PLAY_SKU_ORDERING,
      basePlanId: env.GOOGLE_PLAY_BASE_PLAN_ORDERING,
    },
  };
}
export function playProductForSku(sku: string): PlayProduct | null {
  return sku === env.GOOGLE_PLAY_SKU_ORDERING ? "ordering" : null;
}

// ───────────────────────── Developer API client ─────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
}
function serviceAccount(): ServiceAccount {
  if (!env.PLAY_BILLING_ENABLED || !env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
    throw new ValidationError("Google Play billing is not enabled");
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new ValidationError("Google Play service account is misconfigured");
  }
  const result = z
    .object({ client_email: z.string().email(), private_key: z.string().includes("PRIVATE KEY") })
    .safeParse(parsed);
  if (!result.success) throw new ValidationError("Google Play service account is misconfigured");
  return result.data;
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

let cachedAccessToken: { value: string; expiresAt: number } | undefined;
async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 120 > now) return cachedAccessToken.value;
  const account = serviceAccount();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: PUBLISHER_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(account.private_key);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new ValidationError("Google Play authorization failed");
  const body = z
    .object({ access_token: z.string().min(10), expires_in: z.number().int().positive() })
    .safeParse(await response.json());
  if (!body.success) throw new ValidationError("Unexpected Google authorization response");
  cachedAccessToken = { value: body.data.access_token, expiresAt: now + body.data.expires_in };
  return body.data.access_token;
}

const lineItem = z.object({
  productId: z.string().min(1).max(200),
  expiryTime: z.string().datetime().optional(),
  latestSuccessfulOrderId: z.string().max(200).optional(),
  autoRenewingPlan: z
    .object({
      autoRenewEnabled: z.boolean().optional(),
      recurringPrice: z.object({ currencyCode: z.string().length(3).optional() }).optional(),
    })
    .optional(),
  offerDetails: z.object({ basePlanId: z.string().max(200).optional() }).optional(),
});
const subscriptionV2 = z.object({
  subscriptionState: z.string(),
  acknowledgementState: z.string().optional(),
  latestOrderId: z.string().max(200).optional(),
  linkedPurchaseToken: z.string().max(4096).optional(),
  testPurchase: z.object({}).passthrough().optional(),
  lineItems: z.array(lineItem).min(1).max(8),
});

export interface PlaySubscriptionSnapshot {
  product: PlayProduct;
  playProductId: string;
  basePlanId: string;
  state: PlayState;
  expiry: Date | null;
  autoRenewing: boolean;
  latestOrderId: string | null;
  linkedPurchaseToken: string | null;
  testPurchase: boolean;
  acknowledged: boolean;
  currency: string | null;
}

const STATE_MAP: Record<string, PlayState> = {
  SUBSCRIPTION_STATE_PENDING: "pending",
  SUBSCRIPTION_STATE_ACTIVE: "active",
  SUBSCRIPTION_STATE_CANCELED: "canceled",
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: "grace",
  SUBSCRIPTION_STATE_ON_HOLD: "on_hold",
  SUBSCRIPTION_STATE_PAUSED: "paused",
  SUBSCRIPTION_STATE_EXPIRED: "expired",
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: "expired",
};

/** Pure: validate a Developer API payload against our catalog. Fails closed on anything unexpected. */
export function normalizePlaySubscription(raw: unknown): PlaySubscriptionSnapshot {
  const parsed = subscriptionV2.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Unexpected Google Play subscription response");
  const data = parsed.data;
  const state = STATE_MAP[data.subscriptionState];
  if (!state) throw new ValidationError("Unsupported Google Play subscription state");
  // One product per subscription: bundles and add-ons are not supported and must never be granted.
  if (data.lineItems.length !== 1)
    throw new ValidationError("Unsupported Google Play subscription composition");
  const item = data.lineItems[0]!;
  const product = playProductForSku(item.productId);
  if (!product) throw new ValidationError("Unknown Google Play product");
  const basePlanId = item.offerDetails?.basePlanId ?? "";
  if (basePlanId !== playCatalog()[product].basePlanId)
    throw new ValidationError("Unexpected Google Play base plan");
  const expiry = item.expiryTime ? new Date(item.expiryTime) : null;
  if (expiry && Number.isNaN(expiry.getTime()))
    throw new ValidationError("Invalid Google Play expiry");
  return {
    product,
    playProductId: item.productId,
    basePlanId,
    state,
    expiry,
    autoRenewing: item.autoRenewingPlan?.autoRenewEnabled === true,
    latestOrderId: data.latestOrderId ?? item.latestSuccessfulOrderId ?? null,
    linkedPurchaseToken: data.linkedPurchaseToken ?? null,
    testPurchase: data.testPurchase !== undefined,
    acknowledged: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    currency: item.autoRenewingPlan?.recurringPrice?.currencyCode ?? null,
  };
}

async function publisherFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(
    `${PLAY_ANDROID_PUBLISHER}/applications/${env.GOOGLE_PLAY_PACKAGE_NAME}/${path}`,
    {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${await accessToken()}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }
  );
  return response;
}

export async function fetchPlaySubscription(token: string): Promise<PlaySubscriptionSnapshot> {
  if (!isPlausiblePurchaseToken(token)) throw new ValidationError("Invalid purchase token");
  const response = await publisherFetch(
    `purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`
  );
  // 400/404/410 mean Google does not know this token for our package. Do not leak the body.
  if (response.status === 400 || response.status === 404 || response.status === 410)
    throw new ValidationError("This purchase could not be verified with Google Play");
  if (!response.ok) throw new Error("Google Play verification is temporarily unavailable");
  return normalizePlaySubscription(await response.json());
}

/** Google refunds an unacknowledged purchase after 3 days: acknowledge only after the grant is recorded. */
export async function acknowledgePlaySubscription(sku: string, token: string): Promise<void> {
  if (!isPlausiblePurchaseToken(token) || playProductForSku(sku) === null)
    throw new ValidationError("Invalid purchase");
  const response = await publisherFetch(
    `purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(token)}:acknowledge`,
    { method: "POST", body: "{}" }
  );
  if (!response.ok) throw new Error("Google Play acknowledgement failed");
}

// ───────────────────────── Ledger writes (restricted identity) ─────────────────────────

export interface PlayReconcileResult {
  state: string;
  entitled: boolean;
  grantId?: string | null;
}

export async function lookupPlayPurchase(
  token: string
): Promise<{ organizationId: string; product: PlayProduct; state: string } | null> {
  const row = await billingQuery<{ found: unknown }>(
    "SELECT COALESCE(app_private.play_purchase_lookup($1),'null'::jsonb) AS found",
    [token]
  );
  const found = row.found;
  if (!found || typeof found !== "object") return null;
  return found as { organizationId: string; product: PlayProduct; state: string };
}

async function writePlayState(
  eventId: string,
  token: string,
  snapshot: PlaySubscriptionSnapshot,
  override?: PlayState
): Promise<PlayReconcileResult> {
  const row = await billingQuery<{ result: PlayReconcileResult }>(
    `SELECT app_private.record_play_state($1,$2,$3,$4,$5,$6,$7::timestamptz,$8,$9,$10,$11,$12,$13) AS result`,
    [
      eventId,
      token,
      snapshot.product,
      snapshot.playProductId,
      snapshot.basePlanId,
      override ?? snapshot.state,
      snapshot.expiry ? snapshot.expiry.toISOString() : null,
      snapshot.autoRenewing,
      snapshot.latestOrderId,
      snapshot.linkedPurchaseToken,
      snapshot.testPurchase,
      snapshot.acknowledged,
      snapshot.currency,
    ]
  );
  return row.result;
}

/**
 * Re-query Google, write the resulting state, then acknowledge. The token MUST already be registered
 * to an organization by an authenticated owner (register_play_purchase). Safe to repeat.
 *
 * `onlyIfLatestOrder` is used for voided-purchase notices: an old refunded order must not revoke a
 * later paid cycle.
 */
export async function reconcilePlayPurchase(params: {
  eventId: string;
  token: string;
  revokeIfOrder?: string;
}): Promise<PlayReconcileResult> {
  const snapshot = await fetchPlaySubscription(params.token);
  const revoke =
    params.revokeIfOrder !== undefined && snapshot.latestOrderId === params.revokeIfOrder;
  const result = await writePlayState(
    params.eventId,
    params.token,
    snapshot,
    revoke ? "revoked" : undefined
  );
  if (result.entitled && !snapshot.acknowledged) {
    await acknowledgePlaySubscription(snapshot.playProductId, params.token);
    await writePlayState(`${params.eventId}:ack`, params.token, {
      ...snapshot,
      acknowledged: true,
    });
  }
  return result;
}

export async function recordPlayNotification(eventId: string, kind: string): Promise<boolean> {
  const row = await billingQuery<{ fresh: boolean }>(
    "SELECT app_private.record_play_notification($1,$2) AS fresh",
    [eventId, kind]
  );
  return row.fresh;
}

// ───────────────────────── Pub/Sub push (RTDN) ─────────────────────────

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
type Jwk = crypto.JsonWebKey & { kid?: string };
let certCache: { keys: Jwk[]; fetchedAt: number } | undefined;

async function googleCerts(forceRefresh: boolean): Promise<Jwk[]> {
  if (!forceRefresh && certCache && Date.now() - certCache.fetchedAt < 3_600_000)
    return certCache.keys;
  const response = await fetch(GOOGLE_CERTS_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Unable to load Google signing keys");
  const body = z
    .object({ keys: z.array(z.object({ kid: z.string() }).passthrough()).min(1) })
    .parse(await response.json());
  certCache = { keys: body.keys as Jwk[], fetchedAt: Date.now() };
  return certCache.keys;
}

/**
 * Verify the OIDC bearer token Pub/Sub attaches to push deliveries: Google RS256 signature, issuer,
 * the exact audience (webhook URL) and the exact configured push service account.
 */
export async function verifyPubSubPushToken(authorization: string | null): Promise<boolean> {
  if (
    !env.PLAY_BILLING_ENABLED ||
    !env.GOOGLE_PLAY_RTDN_AUDIENCE ||
    !env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT
  )
    return false;
  const match = /^Bearer ([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(
    authorization ?? ""
  );
  if (!match) return false;
  const [, headerPart, payloadPart, signaturePart] = match as unknown as [
    string,
    string,
    string,
    string,
  ];
  try {
    const header = z
      .object({ alg: z.literal("RS256"), kid: z.string().min(1) })
      .parse(JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8")));
    const claims = z
      .object({
        iss: z.string(),
        aud: z.string(),
        email: z.string(),
        email_verified: z.boolean(),
        exp: z.number(),
        iat: z.number().optional(),
      })
      .parse(JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")));
    const now = Math.floor(Date.now() / 1000);
    if (
      !GOOGLE_ISSUERS.has(claims.iss) ||
      claims.aud !== env.GOOGLE_PLAY_RTDN_AUDIENCE ||
      claims.email.toLowerCase() !== env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT.toLowerCase() ||
      !claims.email_verified ||
      claims.exp <= now ||
      (claims.iat !== undefined && claims.iat > now + 300)
    )
      return false;
    let jwk = (await googleCerts(false)).find((k) => k.kid === header.kid);
    if (!jwk) jwk = (await googleCerts(true)).find((k) => k.kid === header.kid);
    if (!jwk) return false;
    return crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${headerPart}.${payloadPart}`),
      crypto.createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(signaturePart, "base64url")
    );
  } catch {
    return false;
  }
}

const pushEnvelope = z.object({
  message: z.object({
    data: z.string().min(1).max(200_000),
    messageId: z.string().min(8).max(128),
  }),
  subscription: z.string().optional(),
});
const developerNotification = z.object({
  version: z.string().optional(),
  packageName: z.string(),
  eventTimeMillis: z.union([z.string(), z.number()]).optional(),
  subscriptionNotification: z
    .object({
      notificationType: z.number().int(),
      purchaseToken: z.string(),
      subscriptionId: z.string().optional(),
    })
    .optional(),
  voidedPurchaseNotification: z
    .object({
      purchaseToken: z.string(),
      orderId: z.string(),
      productType: z.number().int(),
    })
    .optional(),
  testNotification: z.object({}).passthrough().optional(),
  oneTimeProductNotification: z.object({}).passthrough().optional(),
});
export type PlayDeveloperNotification = z.infer<typeof developerNotification> & {
  messageId: string;
};

/** Pure: decode a Pub/Sub push body. Throws on malformed input. */
export function parsePubSubPush(body: unknown): PlayDeveloperNotification {
  const envelope = pushEnvelope.parse(body);
  const decoded = JSON.parse(Buffer.from(envelope.message.data, "base64").toString("utf8"));
  return { ...developerNotification.parse(decoded), messageId: envelope.message.messageId };
}
