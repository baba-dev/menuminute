import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
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

/**
 * Validates the HMAC SHA256 webhook signature sent by Razorpay.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string
): boolean {
  if (!signature || !webhookSecret || !rawBody) return false;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  if (signature.length !== expectedSignature.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "utf8"),
      Buffer.from(expectedSignature, "utf8")
    );
  } catch {
    return false;
  }
}

/**
 * Creates a subscription via Razorpay's Subscriptions API.
 * Uses native fetch and HTTP Basic Auth.
 */
export async function createRazorpaySubscription(
  options: RazorpaySubscriptionOptions
): Promise<RazorpaySubscriptionResponse> {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new ValidationError(
      "Razorpay API credentials are not configured on this server."
    );
  }

  const payload = {
    plan_id: options.planId,
    total_count: options.totalCount || 120, // 10 years monthly max
    quantity: 1,
    customer_notify: 1,
    notes: {
      organizationId: options.organizationId,
      customerEmail: options.customerEmail || "",
      customerName: options.customerName || "",
    },
  };

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let message = "Failed to create subscription with payment provider";
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed.error?.description) {
        message = parsed.error.description;
      }
    } catch {
      // ignore JSON parse error
    }
    throw new ValidationError(message);
  }

  return (await response.json()) as RazorpaySubscriptionResponse;
}

/**
 * Records an entitlement grant resulting from a Razorpay subscription charge.
 * Uses the security definer function `app_private.record_razorpay_grant`.
 */
export async function recordRazorpaySubscriptionGrant(params: {
  organizationId: string;
  planId: string;
  paymentId: string;
  subscriptionId: string;
  currentStart?: number | null;
  currentEnd?: number | null;
}): Promise<string> {
  const db = getDb();

  // Determine capability based on plan ID or env configuration
  let capability: "ordering.new" | "kitchen.new" = "ordering.new";
  if (
    params.planId === env.RAZORPAY_PLAN_KITCHEN_ID ||
    params.planId.toLowerCase().includes("kitchen")
  ) {
    capability = "kitchen.new";
  }

  const now = new Date();
  const startsAt = params.currentStart ? new Date(params.currentStart * 1000) : now;
  // If no currentEnd supplied, grant 32 days
  const endsAt =
    params.currentEnd && params.currentEnd * 1000 > startsAt.getTime()
      ? new Date(params.currentEnd * 1000)
      : new Date(startsAt.getTime() + 32 * 24 * 60 * 60 * 1000);

  // Deterministic UUID for the grant request key based on payment ID or subscription ID
  const requestKey = crypto
    .createHash("sha256")
    .update(`razorpay:${params.subscriptionId}:${params.paymentId}`)
    .digest("hex")
    .slice(0, 32);

  const formattedKey = `${requestKey.slice(0, 8)}-${requestKey.slice(8, 12)}-4${requestKey.slice(13, 16)}-8${requestKey.slice(17, 20)}-${requestKey.slice(20, 32)}`;

  const result = await db.execute<{ record_razorpay_grant: string }>(
    sql`SELECT app_private.record_razorpay_grant(
      ${params.organizationId},
      ${capability},
      'INR',
      ${startsAt.toISOString()}::timestamptz,
      ${endsAt.toISOString()}::timestamptz,
      'razorpay-webhook',
      ${`Razorpay subscription ${params.subscriptionId} charge ${params.paymentId}`},
      ${formattedKey}
    )`
  );

  return result.rows[0]?.record_razorpay_grant ?? formattedKey;
}
