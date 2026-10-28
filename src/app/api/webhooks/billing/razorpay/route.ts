import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  verifyRazorpayWebhookSignature,
  recordRazorpaySubscriptionGrant,
} from "@/modules/billing/razorpay";

export async function POST(req: Request) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Razorpay Webhook] Missing RAZORPAY_WEBHOOK_SECRET in environment");
    return NextResponse.json(
      { error: "Webhook endpoint not configured" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing x-razorpay-signature header" },
      { status: 400 }
    );
  }

  const rawBody = await req.text();
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature, secret);

  if (!isValid) {
    console.warn("[Razorpay Webhook] Signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const eventType = event.event;

  try {
    if (eventType === "subscription.charged" || eventType === "subscription.activated") {
      const subscription = event.payload?.subscription?.entity;
      const payment = event.payload?.payment?.entity;
      const organizationId =
        subscription?.notes?.organizationId || subscription?.notes?.orgId;

      if (!organizationId) {
        console.warn(
          "[Razorpay Webhook] Received subscription event without organizationId in notes",
          subscription?.id
        );
        return NextResponse.json({ received: true, ignored: "no_org_id" });
      }

      await recordRazorpaySubscriptionGrant({
        organizationId,
        planId: subscription.plan_id,
        paymentId: payment?.id || subscription.id,
        subscriptionId: subscription.id,
        currentStart: subscription.current_start,
        currentEnd: subscription.current_end,
      });

      return NextResponse.json({ received: true, status: "grant_recorded" });
    }

    if (eventType === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const organizationId = payment?.notes?.organizationId;
      const planId = payment?.notes?.planId;

      if (organizationId && planId) {
        await recordRazorpaySubscriptionGrant({
          organizationId,
          planId,
          paymentId: payment.id,
          subscriptionId: payment.id,
          currentStart: Math.floor(Date.now() / 1000),
          currentEnd: Math.floor(Date.now() / 1000) + 32 * 24 * 60 * 60,
        });
      }
      return NextResponse.json({ received: true });
    }

    // Acknowledge other events (e.g. subscription.cancelled, subscription.paused)
    return NextResponse.json({ received: true, event: eventType });
  } catch (error: any) {
    console.error("[Razorpay Webhook Error]", error);
    return NextResponse.json(
      { error: "Webhook processing failed", message: error.message },
      { status: 500 }
    );
  }
}
