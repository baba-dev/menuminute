import crypto from "node:crypto";
import { Pool } from "pg";
import { env } from "@/lib/config/env";
import { ValidationError } from "@/lib/errors";

export interface RazorpaySubscriptionOptions {
  planId: string;
  organizationId: string;
  customerEmail?: string;
  customerName?: string;
  totalCount?: number;
}
export interface RazorpaySubscriptionResponse {
  id: string;
  plan_id: string;
  status: string;
  current_start?: number;
  current_end?: number;
  short_url?: string;
  notes?: Record<string, string>;
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret || !rawBody) return false;
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  if (signature.length !== expected.length || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"));
}

export function providerEventId(rawBody: string): string {
  return crypto.createHash("sha256").update(rawBody).digest("hex");
}

export function razorpayPlanForProduct(product: "ordering" | "kitchen_pro") {
  const planId =
    product === "ordering" ? env.RAZORPAY_PLAN_ORDERING_ID : env.RAZORPAY_PLAN_KITCHEN_ID;
  if (!planId) throw new ValidationError("Billing provider plan is unavailable");
  if (product === "kitchen_pro" && !env.RAZORPAY_KITCHEN_ENABLED)
    throw new ValidationError("Kitchen Pro is not approved for commercial activation");
  return { planId, amountPaise: product === "ordering" ? 11900 : 29900 };
}

export async function createRazorpaySubscription(
  options: RazorpaySubscriptionOptions
): Promise<RazorpaySubscriptionResponse> {
  if (!env.RAZORPAY_ENABLED || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)
    throw new ValidationError("Subscriptions are not enabled");
  const authorization = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${authorization}` },
    body: JSON.stringify({
      plan_id: options.planId,
      total_count: options.totalCount ?? 60,
      quantity: 1,
      customer_notify: 1,
      notes: { organizationId: options.organizationId },
    }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!response.ok) {
    // Do not leak provider payloads, customer data, or credentials into the UI/logs.
    throw new ValidationError("The payment provider could not create this subscription");
  }
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("id" in result) ||
    typeof result.id !== "string" ||
    !result.id.startsWith("sub_") ||
    !("plan_id" in result) ||
    result.plan_id !== options.planId
  ) throw new ValidationError("Unexpected provider subscription response");
  return result as RazorpaySubscriptionResponse;
}

let paymentPool: Pool | undefined;
function isolatedPool(): Pool {
  if (!env.RAZORPAY_ENABLED || !env.BILLING_DATABASE_URL)
    throw new ValidationError("The billing writer is not configured");
  if (!paymentPool) {
    paymentPool = new Pool({
      connectionString: env.BILLING_DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 3000,
      statement_timeout: 5000,
      query_timeout: 6000,
      application_name: "menuminute-billing-webhook",
    });
    paymentPool.on("error", () => console.error("[billing] Database connection error"));
  }
  return paymentPool;
}
async function billingQuery<T extends Record<string, unknown>>(
  sql: string,
  params: readonly unknown[]
): Promise<T> {
  const client = await isolatedPool().connect();
  try {
    const identity = await client.query<{ current_user: string }>("SELECT current_user");
    if (identity.rows[0]?.current_user !== "menuminute_billing")
      throw new Error("Billing connection is not the restricted payment identity");
    const response = await client.query<T>(sql, [...params]);
    if (!response.rows[0]) throw new Error("Missing database billing acknowledgement");
    return response.rows[0];
  } finally {
    client.release();
  }
}

/** Caller MUST have verified the Razorpay signature, payment status, amount and plan. */
export async function recordRazorpaySubscriptionGrant(params: {
  eventId: string;
  subscriptionId: string;
  planId: string;
  paymentId: string;
  currentStart: number;
  currentEnd: number;
  providerCreated: number;
}): Promise<string> {
  const { eventId, subscriptionId, planId, paymentId, currentStart, currentEnd, providerCreated } =
    params;
  if (
    !Number.isSafeInteger(currentStart) ||
    !Number.isSafeInteger(currentEnd) ||
    !Number.isSafeInteger(providerCreated) ||
    currentEnd <= currentStart ||
    currentEnd <= Date.now() / 1000 ||
    currentEnd - currentStart > 40 * 86400
  ) throw new ValidationError("Invalid subscription billing period");
  const result = await billingQuery<{ grant_id: string }>(
    `SELECT app_private.record_razorpay_charge($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7::timestamptz) AS grant_id`,
    [
      eventId, subscriptionId, planId, paymentId,
      new Date(currentStart * 1000).toISOString(),
      new Date(currentEnd * 1000).toISOString(),
      new Date(providerCreated * 1000).toISOString(),
    ]
  );
  return result.grant_id;
}

export async function recordRazorpaySubscriptionStatus(params: {
  eventId: string;
  subscriptionId: string;
  status: "paused" | "halted" | "cancelled" | "completed" | "expired";
  providerCreated: number;
}): Promise<void> {
  if (!Number.isSafeInteger(params.providerCreated))
    throw new ValidationError("Invalid provider event timestamp");
  await billingQuery<{ recorded: string }>(
    "SELECT app_private.record_razorpay_status($1,$2,$3,$4::timestamptz)::text AS recorded",
    [
      params.eventId, params.subscriptionId, params.status,
      new Date(params.providerCreated * 1000).toISOString(),
    ]
  );
}

/** Owner-initiated cancellation: retain already-paid access until the provider's cycle end. */
export async function requestRazorpayCancellation(subscriptionId: string): Promise<void> {
  if (!env.RAZORPAY_ENABLED || !env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)
    throw new ValidationError("Subscriptions are not enabled");
  if (!/^sub_[a-zA-Z0-9]{6,100}$/.test(subscriptionId))
    throw new ValidationError("Invalid subscription ID");
  const authorization = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch(
    `https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${authorization}` },
      body: JSON.stringify({ cancel_at_cycle_end: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!response.ok) throw new ValidationError("Unable to schedule cancellation with provider");
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("id" in body) || body.id !== subscriptionId)
    throw new ValidationError("Unexpected provider cancellation response");
}
