import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

const m = vi.hoisted(() => ({
  query: vi.fn(),
  env: {
    PLAY_BILLING_ENABLED: true,
    COMMUNITY_EDITION: false,
    GOOGLE_PLAY_PACKAGE_NAME: "com.bababuilds.menuminute",
    GOOGLE_PLAY_RTDN_AUDIENCE: "https://food.bababuilds.com/api/webhooks/billing/google-play",
    GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT: "rtdn-push@project.iam.gserviceaccount.com",
    GOOGLE_PLAY_SKU_ORDERING: "menuminute_ordering",
    GOOGLE_PLAY_BASE_PLAN_ORDERING: "monthly",
    GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: undefined as string | undefined,
  },
}));
vi.mock("@/lib/config/env", () => ({ env: m.env }));
vi.mock("@/modules/billing/razorpay", () => ({ billingQuery: m.query }));

import {
  isPlausiblePurchaseToken,
  normalizePlaySubscription,
  parsePubSubPush,
  verifyPubSubPushToken,
  reconcilePlayPurchase,
} from "../src/modules/billing/play";
import { POST } from "../src/app/api/webhooks/billing/google-play/route";

const future = new Date(Date.now() + 25 * 86_400_000).toISOString();
const subscription = (over: Record<string, unknown> = {}) => ({
  subscriptionState: "SUBSCRIPTION_STATE_ACTIVE",
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
  latestOrderId: "GPA.3333-1111-2222-12345",
  lineItems: [
    {
      productId: "menuminute_ordering",
      expiryTime: future,
      autoRenewingPlan: { autoRenewEnabled: true, recurringPrice: { currencyCode: "INR" } },
      offerDetails: { basePlanId: "monthly" },
    },
  ],
  ...over,
});

describe("Play subscription normalization (Developer API payload)", () => {
  it("maps a valid subscription to our catalog", () => {
    expect(normalizePlaySubscription(subscription())).toMatchObject({
      product: "ordering",
      state: "active",
      autoRenewing: true,
      acknowledged: false,
      currency: "INR",
      testPurchase: false,
    });
  });
  it.each([
    ["SUBSCRIPTION_STATE_CANCELED", "canceled"],
    ["SUBSCRIPTION_STATE_IN_GRACE_PERIOD", "grace"],
    ["SUBSCRIPTION_STATE_ON_HOLD", "on_hold"],
    ["SUBSCRIPTION_STATE_PAUSED", "paused"],
    ["SUBSCRIPTION_STATE_EXPIRED", "expired"],
    ["SUBSCRIPTION_STATE_PENDING", "pending"],
    ["SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED", "expired"],
  ])("maps %s to %s", (raw, state) => {
    expect(normalizePlaySubscription(subscription({ subscriptionState: raw })).state).toBe(state);
  });
  it("fails closed on unknown products, plans, states, bundles and bad dates", () => {
    const item = subscription().lineItems[0]!;
    expect(() =>
      normalizePlaySubscription(subscription({ lineItems: [{ ...item, productId: "other_sku" }] }))
    ).toThrow("Unknown Google Play product");
    expect(() =>
      normalizePlaySubscription(
        subscription({ lineItems: [{ ...item, offerDetails: { basePlanId: "yearly" } }] })
      )
    ).toThrow("Unexpected Google Play base plan");
    expect(() =>
      normalizePlaySubscription(subscription({ subscriptionState: "NEW_STATE" }))
    ).toThrow();
    expect(() => normalizePlaySubscription(subscription({ lineItems: [item, item] }))).toThrow(
      "Unsupported Google Play subscription composition"
    );
    expect(() =>
      normalizePlaySubscription(subscription({ lineItems: [{ ...item, expiryTime: "soon" }] }))
    ).toThrow();
    expect(() => normalizePlaySubscription({})).toThrow();
  });
  it("flags test purchases and acknowledged state", () => {
    expect(
      normalizePlaySubscription(
        subscription({
          testPurchase: {},
          acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
        })
      )
    ).toMatchObject({ testPurchase: true, acknowledged: true });
  });
  it("accepts only plausible purchase tokens", () => {
    expect(isPlausiblePurchaseToken("abcdefghijklmnop.AO-J1Oy_x")).toBe(true);
    for (const bad of ["short", "has space in token!!", "a/../b".padEnd(20, "x") + "\n", 42, null])
      expect(isPlausiblePurchaseToken(bad)).toBe(false);
  });
});

describe("Pub/Sub push parsing", () => {
  const push = (payload: unknown, messageId = "msg-12345678") => ({
    message: { data: Buffer.from(JSON.stringify(payload)).toString("base64"), messageId },
    subscription: "projects/p/subscriptions/s",
  });
  it("decodes a subscription notification", () => {
    const parsed = parsePubSubPush(
      push({
        version: "1.0",
        packageName: "com.bababuilds.menuminute",
        eventTimeMillis: "1700000000000",
        subscriptionNotification: {
          version: "1.0",
          notificationType: 2,
          purchaseToken: "tok-abcdefghijklmnop",
          subscriptionId: "menuminute_ordering",
        },
      })
    );
    expect(parsed.messageId).toBe("msg-12345678");
    expect(parsed.subscriptionNotification?.notificationType).toBe(2);
  });
  it("rejects malformed envelopes", () => {
    expect(() => parsePubSubPush({})).toThrow();
    expect(() => parsePubSubPush({ message: { data: "!!", messageId: "msg-12345678" } })).toThrow();
  });
});

describe("Pub/Sub OIDC verification", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1", alg: "RS256", use: "sig" };
  const realFetch = globalThis.fetch;
  beforeAll(() => {
    globalThis.fetch = vi.fn(async () => Response.json({ keys: [jwk] })) as unknown as typeof fetch;
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });
  const now = Math.floor(Date.now() / 1000);
  function token(
    claims: Record<string, unknown> = {},
    opts: { key?: crypto.KeyObject; alg?: string; kid?: string } = {}
  ) {
    const header = Buffer.from(
      JSON.stringify({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "key-1", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        iss: "https://accounts.google.com",
        aud: m.env.GOOGLE_PLAY_RTDN_AUDIENCE,
        email: m.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT,
        email_verified: true,
        iat: now,
        exp: now + 3000,
        ...claims,
      })
    ).toString("base64url");
    const sig = crypto
      .sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), opts.key ?? privateKey)
      .toString("base64url");
    return `Bearer ${header}.${payload}.${sig}`;
  }
  it("accepts a correctly signed token from the configured push identity", async () => {
    expect(await verifyPubSubPushToken(token())).toBe(true);
  });
  it("rejects wrong signature, audience, identity, issuer, expiry, algorithm and unknown key", async () => {
    expect(await verifyPubSubPushToken(token({}, { key: other.privateKey }))).toBe(false);
    expect(await verifyPubSubPushToken(token({ aud: "https://evil.example/hook" }))).toBe(false);
    expect(
      await verifyPubSubPushToken(token({ email: "attacker@project.iam.gserviceaccount.com" }))
    ).toBe(false);
    expect(await verifyPubSubPushToken(token({ email_verified: false }))).toBe(false);
    expect(await verifyPubSubPushToken(token({ iss: "https://evil.example" }))).toBe(false);
    expect(await verifyPubSubPushToken(token({ exp: now - 10 }))).toBe(false);
    expect(await verifyPubSubPushToken(token({}, { alg: "none" }))).toBe(false);
    expect(await verifyPubSubPushToken(token({}, { kid: "unknown" }))).toBe(false);
    expect(await verifyPubSubPushToken(null)).toBe(false);
    expect(await verifyPubSubPushToken("Bearer a.b")).toBe(false);
    expect(await verifyPubSubPushToken("Basic abc")).toBe(false);
  });
  it("is closed when billing is disabled", async () => {
    m.env.PLAY_BILLING_ENABLED = false;
    expect(await verifyPubSubPushToken(token())).toBe(false);
    m.env.PLAY_BILLING_ENABLED = true;
  });
});

describe("Google Play RTDN webhook route", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "route-key", alg: "RS256" };
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const bearer = () => {
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: "route-key" })).toString("base64url");
    const p = Buffer.from(
      JSON.stringify({
        iss: "accounts.google.com",
        aud: m.env.GOOGLE_PLAY_RTDN_AUDIENCE,
        email: m.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT,
        email_verified: true,
        exp: now + 600,
      })
    ).toString("base64url");
    return `Bearer ${h}.${p}.${crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey).toString("base64url")}`;
  };
  const request = (payload: unknown, auth: string | null = bearer(), id = "message-0001") =>
    new Request(m.env.GOOGLE_PLAY_RTDN_AUDIENCE, {
      method: "POST",
      headers: auth ? { authorization: auth } : {},
      body: JSON.stringify({
        message: { data: Buffer.from(JSON.stringify(payload)).toString("base64"), messageId: id },
      }),
    });
  const base = { packageName: "com.bababuilds.menuminute", eventTimeMillis: "1" };
  const subNote = (token = "purchase-token-abcdefghij") => ({
    ...base,
    subscriptionNotification: {
      notificationType: 2,
      purchaseToken: token,
      subscriptionId: "menuminute_ordering",
    },
  });
  beforeAll(() => {
    // Offline: certs endpoint and Developer API are served by this stub.
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u}`);
      if (u.includes("oauth2/v3/certs")) return Response.json({ keys: [jwk] });
      if (u.includes("oauth2.googleapis.com/token"))
        return Response.json({ access_token: "ya29.test-token", expires_in: 3599 });
      if (u.includes("subscriptionsv2")) return Response.json(subscription());
      if (u.includes(":acknowledge")) return Response.json({});
      return new Response("unexpected", { status: 500 });
    }) as unknown as typeof fetch;
    const { privateKey: sa } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    m.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "play-api@project.iam.gserviceaccount.com",
      private_key: sa.export({ type: "pkcs8", format: "pem" }),
    });
  });
  afterAll(() => {
    globalThis.fetch = realFetch;
  });
  beforeEach(() => {
    m.query.mockReset();
    calls.length = 0;
  });

  it("rejects unauthenticated, forged and disabled deliveries before touching the ledger", async () => {
    expect((await POST(request(subNote(), null))).status).toBe(401);
    expect((await POST(request(subNote(), "Bearer a.b.c"))).status).toBe(401);
    m.env.PLAY_BILLING_ENABLED = false;
    expect((await POST(request(subNote()))).status).toBe(503);
    m.env.PLAY_BILLING_ENABLED = true;
    expect(m.query).not.toHaveBeenCalled();
  });
  it("acknowledges (does not retry) malformed, foreign-package and unsupported messages", async () => {
    const bad = new Request(m.env.GOOGLE_PLAY_RTDN_AUDIENCE, {
      method: "POST",
      headers: { authorization: bearer() },
      body: "not json",
    });
    expect(await (await POST(bad)).json()).toMatchObject({ ignored: "malformed" });
    expect(
      await (await POST(request({ ...subNote(), packageName: "com.other.app" }))).json()
    ).toMatchObject({
      ignored: "package",
    });
    m.query.mockResolvedValue({ fresh: true });
    expect(
      await (await POST(request({ ...base, oneTimeProductNotification: {} }))).json()
    ).toMatchObject({
      ignored: "unsupported",
    });
  });
  it("records test notifications and ignores tokens no owner registered", async () => {
    m.query.mockResolvedValue({ fresh: true });
    expect(
      await (await POST(request({ ...base, testNotification: { version: "1.0" } }))).json()
    ).toMatchObject({
      test: true,
    });
    m.query.mockResolvedValueOnce({ found: null }).mockResolvedValue({ fresh: true });
    expect(await (await POST(request(subNote()))).json()).toMatchObject({
      ignored: "unregistered",
    });
    expect(calls.filter((c) => c.includes("subscriptionsv2"))).toHaveLength(0);
  });
  it("re-queries Google, records state, then acknowledges only an entitled purchase", async () => {
    m.query
      .mockResolvedValueOnce({
        found: { organizationId: "org", product: "ordering", state: "registered" },
      })
      .mockResolvedValue({ result: { state: "active", entitled: true } });
    const response = await POST(request(subNote()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ state: "active" });
    const order = calls.filter((c) => c.includes("subscriptionsv2") || c.includes(":acknowledge"));
    expect(order[0]).toContain("subscriptionsv2/tokens/purchase-token-abcdefghij");
    expect(order[1]).toMatch(
      /^POST .*purchases\/subscriptions\/menuminute_ordering\/tokens\/.*:acknowledge$/
    );
    const stateCalls = m.query.mock.calls.filter((c) => String(c[0]).includes("record_play_state"));
    expect(stateCalls).toHaveLength(2);
    // The notification body never reaches the ledger: only the re-queried state does.
    expect(stateCalls[0]![1][5]).toBe("active");
    expect(stateCalls[1]![1][11]).toBe(true);
  });
  it("does not acknowledge when the ledger refuses entitlement (so Google auto-refunds a conflict)", async () => {
    m.query
      .mockResolvedValueOnce({
        found: { organizationId: "org", product: "ordering", state: "registered" },
      })
      .mockResolvedValue({ result: { state: "conflict", entitled: false } });
    const response = await POST(request(subNote(), bearer(), "message-0002"));
    expect(response.status).toBe(200);
    expect(calls.some((c) => c.includes(":acknowledge"))).toBe(false);
  });
  it("revokes on a voided purchase only when the voided order is the latest order", async () => {
    const voided = (orderId: string) => ({
      ...base,
      voidedPurchaseNotification: {
        purchaseToken: "purchase-token-abcdefghij",
        orderId,
        productType: 1,
      },
    });
    m.query
      .mockResolvedValueOnce({
        found: { organizationId: "org", product: "ordering", state: "active" },
      })
      .mockResolvedValue({ result: { state: "revoked", entitled: false } });
    await POST(request(voided("GPA.3333-1111-2222-12345"), bearer(), "message-0003"));
    expect(m.query.mock.calls.find((c) => String(c[0]).includes("record_play_state"))![1][5]).toBe(
      "revoked"
    );

    m.query.mockReset();
    m.query
      .mockResolvedValueOnce({
        found: { organizationId: "org", product: "ordering", state: "active" },
      })
      .mockResolvedValue({ result: { state: "active", entitled: true } });
    await POST(request(voided("GPA.0000-0000-0000-00000"), bearer(), "message-0004"));
    expect(m.query.mock.calls.find((c) => String(c[0]).includes("record_play_state"))![1][5]).toBe(
      "active"
    );
  });
  it("returns 503 so Pub/Sub redelivers when reconciliation fails", async () => {
    m.query
      .mockResolvedValueOnce({
        found: { organizationId: "org", product: "ordering", state: "active" },
      })
      .mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await POST(request(subNote(), bearer(), "message-0005"))).status).toBe(503);
    spy.mockRestore();
  });
  it("surfaces unverifiable purchases without leaking provider detail", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("subscriptionsv2")
        ? new Response("token not found", { status: 404 })
        : (original as typeof fetch)(url as string)
    ) as unknown as typeof fetch;
    await expect(
      reconcilePlayPurchase({ eventId: "verify:abc-12345", token: "purchase-token-abcdefghij" })
    ).rejects.toThrow("could not be verified");
    globalThis.fetch = original;
  });
});
