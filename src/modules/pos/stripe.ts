import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env, type Env } from "@/lib/config/env";

const checkoutResponse = z
  .object({
    id: z.string().regex(/^cs_(?:test|live)_[A-Za-z0-9]+$/),
    url: z.string().url(),
    payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
    payment_intent: z.string().nullable().optional(),
    expires_at: z.number().int().positive().optional(),
  })
  .passthrough();
const refundResponse = z
  .object({
    id: z.string().regex(/^re_[A-Za-z0-9]+$/),
    payment_intent: z.string(),
    amount: z.number().int().positive(),
    currency: z.string().length(3),
    status: z.enum(["pending", "requires_action", "succeeded", "failed", "canceled"]),
  })
  .passthrough();

export class PaymentProviderError extends Error {
  constructor(public readonly uncertain: boolean) {
    super(
      uncertain
        ? "Payment provider outcome is uncertain. Reconcile this attempt before retrying."
        : "Payment provider rejected the request."
    );
    this.name = "PaymentProviderError";
  }
}

async function stripePost<T>(
  path: string,
  body: URLSearchParams,
  idempotencyKey: string,
  schema: z.ZodType<T>,
  config: Env = env,
  request: typeof fetch = fetch
): Promise<T> {
  if (!config.POS_STRIPE_ENABLED || !config.POS_STRIPE_SECRET_KEY)
    throw new PaymentProviderError(false);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await request(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.POS_STRIPE_SECRET_KEY}:`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
      },
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status >= 500 || response.status === 409 || response.status === 429)
        throw new PaymentProviderError(true);
      throw new PaymentProviderError(false);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new PaymentProviderError(true);
    return parsed.data;
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    throw new PaymentProviderError(true);
  } finally {
    clearTimeout(timeout);
  }
}

export async function createStripeCheckout(
  input: {
    attemptId: string;
    amountMinor: string;
    currency: string;
    orderLabel: string;
  },
  config: Env = env,
  request: typeof fetch = fetch
) {
  const returnUrl = new URL("/dashboard/pos/ledger", config.APP_URL);
  returnUrl.searchParams.set("provider_return", input.attemptId);
  const body = new URLSearchParams({
    mode: "payment",
    client_reference_id: input.attemptId,
    success_url: returnUrl.toString(),
    cancel_url: returnUrl.toString(),
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": input.orderLabel,
    "line_items[0][price_data][unit_amount]": input.amountMinor,
    "line_items[0][quantity]": "1",
    "metadata[menuminute_attempt_id]": input.attemptId,
    "payment_intent_data[metadata][menuminute_attempt_id]": input.attemptId,
  });
  const result = await stripePost(
    "checkout/sessions",
    body,
    input.attemptId,
    checkoutResponse,
    config,
    request
  );
  const checkoutUrl = new URL(result.url);
  if (checkoutUrl.protocol !== "https:" || checkoutUrl.hostname !== "checkout.stripe.com")
    throw new PaymentProviderError(true);
  return {
    externalId: result.id,
    externalPaymentId: result.payment_intent ?? null,
    checkoutUrl: checkoutUrl.toString(),
    expiresAt: result.expires_at ? new Date(result.expires_at * 1000).toISOString() : null,
  };
}

export async function createStripeRefund(
  input: { attemptId: string; paymentIntentId: string; amountMinor: string },
  config: Env = env,
  request: typeof fetch = fetch
) {
  const result = await stripePost(
    "refunds",
    new URLSearchParams({
      payment_intent: input.paymentIntentId,
      amount: input.amountMinor,
      "metadata[menuminute_attempt_id]": input.attemptId,
    }),
    input.attemptId,
    refundResponse,
    config,
    request
  );
  return {
    externalId: result.id,
    externalPaymentId: result.payment_intent,
    state:
      result.status === "succeeded"
        ? ("succeeded" as const)
        : result.status === "failed" || result.status === "canceled"
          ? ("failed" as const)
          : ("pending" as const),
  };
}

export function verifyStripeWebhook(
  body: Buffer,
  signature: string | null,
  secret = env.POS_STRIPE_WEBHOOK_SECRET,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (!secret || !signature) throw new PaymentProviderError(false);
  const parts = signature.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = Number(parts.find(([key]) => key === "t")?.[1]);
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value ?? "");
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300 || !signatures.length)
    throw new PaymentProviderError(false);
  const expected = createHmac("sha256", secret)
    .update(String(timestamp))
    .update(".")
    .update(body)
    .digest();
  const valid = signatures.some((candidate) => {
    if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
    const supplied = Buffer.from(candidate, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
  if (!valid) throw new PaymentProviderError(false);
  return z
    .object({
      id: z.string().min(1).max(255),
      type: z.enum([
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
        "refund.created",
        "refund.updated",
        "refund.failed",
      ]),
      data: z.object({ object: z.record(z.string(), z.unknown()) }).strict(),
    })
    .passthrough()
    .parse(JSON.parse(body.toString("utf8")));
}
