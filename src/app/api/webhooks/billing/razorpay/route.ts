import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import {
  providerEventId,
  recordRazorpaySubscriptionGrant,
  recordRazorpaySubscriptionStatus,
  verifyRazorpayWebhookSignature,
} from "@/modules/billing/razorpay";

const subscription = z.object({
  id: z.string().startsWith("sub_"),
  plan_id: z.string().startsWith("plan_"),
  current_start: z.number().int().positive().nullish(),
  current_end: z.number().int().positive().nullish(),
});
const webhook = z.object({
  event: z.string(),
  created_at: z.number().int().positive(),
  payload: z.object({
    subscription: z.object({ entity: subscription }),
    payment: z.object({
      entity: z.object({
        id: z.string().startsWith("pay_"),
        status: z.string(),
        amount: z.number().int().nonnegative(),
        currency: z.string(),
      }),
    }).optional(),
  }),
});

export async function POST(req: Request) {
  if (!env.RAZORPAY_ENABLED || env.COMMUNITY_EDITION || !env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing is unavailable" }, { status: 503 });
  }
  const signature = req.headers.get("x-razorpay-signature") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(signature))
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > 256_000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > 256_000)
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  if (!verifyRazorpayWebhookSignature(raw, signature, env.RAZORPAY_WEBHOOK_SECRET))
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventName = (parsed as { event?: unknown } | null)?.event;
  if (typeof eventName !== "string")
    return NextResponse.json({ error: "Invalid event" }, { status: 422 });
  const supported = new Set([
    "subscription.charged",
    "subscription.paused",
    "subscription.halted",
    "subscription.cancelled",
    "subscription.completed",
    "subscription.expired",
  ]);
  // Payment capture alone and subscription authorization are not proof of a paid billing period.
  if (!supported.has(eventName))
    return NextResponse.json({ received: true, ignored: eventName });

  const result = webhook.safeParse(parsed);
  if (!result.success) return NextResponse.json({ error: "Invalid provider event" }, { status: 422 });
  const { event, created_at: createdAt, payload } = result.data;
  const recordId = providerEventId(raw);
  const sub = payload.subscription.entity;
  try {
    if (event === "subscription.charged") {
      const payment = payload.payment?.entity;
      const expectedAmount =
        sub.plan_id === env.RAZORPAY_PLAN_ORDERING_ID
          ? 11900
          : sub.plan_id === env.RAZORPAY_PLAN_KITCHEN_ID && env.RAZORPAY_KITCHEN_ENABLED
            ? 29900
            : null;
      if (
        expectedAmount === null ||
        !payment ||
        payment.status !== "captured" ||
        payment.currency !== "INR" ||
        payment.amount < expectedAmount ||
        sub.current_start == null ||
        sub.current_end == null
      )
        return NextResponse.json({ error: "Payment does not match an approved subscription" }, { status: 422 });
      await recordRazorpaySubscriptionGrant({
        eventId: recordId,
        subscriptionId: sub.id,
        planId: sub.plan_id,
        paymentId: payment.id,
        currentStart: sub.current_start,
        currentEnd: sub.current_end,
        providerCreated: createdAt,
      });
      return NextResponse.json({ received: true, state: "charged" });
    }
    const status = event.slice("subscription.".length) as
      | "paused" | "halted" | "cancelled" | "completed" | "expired";
    await recordRazorpaySubscriptionStatus({
      eventId: recordId,
      subscriptionId: sub.id,
      status,
      providerCreated: createdAt,
    });
    return NextResponse.json({ received: true, state: status });
  } catch {
    // Do not reveal internal SQL errors, organization IDs or billing identifiers.
    console.error("[billing] Verified provider event could not be reconciled");
    return NextResponse.json({ error: "Reconciliation temporarily unavailable" }, { status: 503 });
  }
}
