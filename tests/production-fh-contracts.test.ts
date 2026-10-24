import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "../src/lib/config/env";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import {
  applyMenuTranslation,
  menuLocaleSchema,
  sameTranslationShape,
  translationTemplate,
} from "../src/modules/menu-product/translations";
import {
  createStripeCheckout,
  PaymentProviderError,
  verifyStripeWebhook,
} from "../src/modules/pos/stripe";

const providerEnv = parseEnv({
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "isolated-provider-test-key-at-least-32-characters",
  DATABASE_URL: "postgresql://app:password@localhost/menuminute_test",
  REDIS_QUEUE_URL: "redis://localhost:6379",
  REDIS_CACHE_URL: "redis://localhost:6380",
  EMAIL_PROVIDER: "test",
  AUTH_ALLOW_TEST_EMAIL: "true",
  POS_STRIPE_ENABLED: "true",
  POS_STRIPE_SECRET_KEY: "sk_test_isolated",
  POS_STRIPE_WEBHOOK_SECRET: "whsec_isolated",
});

describe("production F localization contracts", () => {
  const canonical = menuDocumentSchema.parse({
    name: "Lunch",
    currency: "INR",
    presentation: { headline: "Made today" },
    categories: [
      {
        id: "mains",
        name: "Mains",
        items: [
          {
            id: "plate",
            name: "Plate",
            description: "House plate",
            priceMinor: 12500,
            variants: [{ id: "large", name: "Large", priceMinor: 18000 }],
            addOnGroups: [
              {
                id: "extras",
                name: "Extras",
                min: 0,
                max: 1,
                options: [{ id: "bread", name: "Bread", priceMinor: 1500 }],
              },
            ],
          },
        ],
      },
    ],
  });

  it("canonicalizes locale tags and overlays display text without changing commercial facts", () => {
    expect(menuLocaleSchema.parse("hi-in")).toBe("hi-IN");
    const translated = translationTemplate(canonical);
    translated.name = "दोपहर का भोजन";
    translated.categories[0]!.items[0]!.name = "थाली";
    translated.categories[0]!.items[0]!.variants[0]!.name = "बड़ी";
    const projected = applyMenuTranslation(canonical, translated);
    expect(projected.name).toBe("दोपहर का भोजन");
    expect(projected.categories[0]!.items[0]).toMatchObject({
      id: "plate",
      name: "थाली",
      priceMinor: 12500,
      variants: [{ id: "large", name: "बड़ी", priceMinor: 18000 }],
    });
    expect(projected.categories[0]!.items[0]!.addOnGroups[0]!.options[0]!.priceMinor).toBe(1500);
  });

  it("rejects a translation whose immutable catalog shape is stale", () => {
    const translated = translationTemplate(canonical);
    translated.categories[0]!.items[0]!.id = "different-dish";
    expect(sameTranslationShape(canonical, translated)).toBe(false);
  });
});

describe("production G provider boundary", () => {
  it("signs no secrets into payloads and uses the attempt as Stripe's idempotency key", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cs_test_checkout123",
          url: "https://checkout.stripe.com/c/pay/cs_test_checkout123",
          payment_status: "unpaid",
          expires_at: 1_900_000_000,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const result = await createStripeCheckout(
      { attemptId: "attempt-123", amountMinor: "12500", currency: "INR", orderLabel: "Order" },
      providerEnv,
      request
    );
    expect(result.externalId).toBe("cs_test_checkout123");
    const [, init] = request.mock.calls[0]!;
    expect(new Headers(init?.headers).get("idempotency-key")).toBe("attempt-123");
    expect(String(init?.body)).toContain("metadata%5Bmenuminute_attempt_id%5D=attempt-123");
    expect(String(init?.body)).not.toContain(providerEnv.POS_STRIPE_SECRET_KEY);
  });

  it("accepts a current authentic raw webhook and rejects tampering or stale signatures", () => {
    const now = 1_900_000_000;
    const body = Buffer.from(
      JSON.stringify({
        id: "evt_123",
        type: "checkout.session.completed",
        data: { object: { id: "cs_test_checkout123" } },
      })
    );
    const digest = createHmac("sha256", "whsec_isolated")
      .update(`${now}.`)
      .update(body)
      .digest("hex");
    const signature = `t=${now},v1=${digest}`;
    expect(verifyStripeWebhook(body, signature, "whsec_isolated", now).id).toBe("evt_123");
    expect(() =>
      verifyStripeWebhook(Buffer.from(`${body.toString()} `), signature, "whsec_isolated", now)
    ).toThrow(PaymentProviderError);
    expect(() => verifyStripeWebhook(body, signature, "whsec_isolated", now + 301)).toThrow(
      PaymentProviderError
    );
  });

  it("fails closed on a non-Stripe checkout redirect", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cs_test_checkout123",
          url: "https://attacker.example/capture",
          payment_status: "unpaid",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    await expect(
      createStripeCheckout(
        { attemptId: "attempt-123", amountMinor: "12500", currency: "INR", orderLabel: "Order" },
        providerEnv,
        request
      )
    ).rejects.toMatchObject({ uncertain: true });
  });
});
