import { boundedBytes } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import {
  isPlausiblePurchaseToken,
  lookupPlayPurchase,
  parsePubSubPush,
  reconcilePlayPurchase,
  recordPlayNotification,
  verifyPubSubPushToken,
} from "@/modules/billing/play";

/**
 * Google Play Real-time Developer Notifications (Pub/Sub push). Authenticated by the OIDC token Pub/Sub
 * attaches (signature, audience and exact service account). The body is NOT trusted: it is only a hint
 * that a purchase token changed. State is always re-queried from the Google Play Developer API.
 *
 * Response contract with Pub/Sub: 2xx acknowledges; anything else is redelivered with backoff.
 */
async function observed_POST(req: Request) {
  if (!env.PLAY_BILLING_ENABLED || env.COMMUNITY_EDITION)
    return NextResponse.json({ error: "Billing is unavailable" }, { status: 503 });
  if (!(await verifyPubSubPushToken(req.headers.get("authorization"))))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let notification;
  try {
    const raw = (await boundedBytes(req, 256_000)).toString("utf8");
    notification = parsePubSubPush(JSON.parse(raw));
  } catch {
    // A malformed authenticated message will never become valid: acknowledge to stop redelivery.
    return NextResponse.json({ received: true, ignored: "malformed" });
  }
  if (notification.packageName !== env.GOOGLE_PLAY_PACKAGE_NAME)
    return NextResponse.json({ received: true, ignored: "package" });

  const eventId = `rtdn:${notification.messageId}`;
  try {
    if (notification.testNotification) {
      await recordPlayNotification(eventId, "test");
      return NextResponse.json({ received: true, test: true });
    }
    const voided = notification.voidedPurchaseNotification;
    const subscription = notification.subscriptionNotification;
    // productType 1 = subscription voided; 2 = one-time product (not sold).
    const token = voided?.productType === 1 ? voided.purchaseToken : subscription?.purchaseToken;
    if (!token || !isPlausiblePurchaseToken(token)) {
      await recordPlayNotification(eventId, "ignored");
      return NextResponse.json({ received: true, ignored: "unsupported" });
    }
    // A notification for a token no owner has registered cannot be attributed to an organization. It is
    // acknowledged; the owner's app re-submits the token on next launch (restore) and Google is re-queried.
    if (!(await lookupPlayPurchase(token))) {
      await recordPlayNotification(eventId, "unregistered");
      return NextResponse.json({ received: true, ignored: "unregistered" });
    }
    const result = await reconcilePlayPurchase({
      eventId,
      token,
      revokeIfOrder: voided?.productType === 1 ? voided.orderId : undefined,
    });
    return NextResponse.json({ received: true, state: result.state });
  } catch {
    // Never reveal SQL, tokens or organization identifiers. 503 makes Pub/Sub redeliver.
    console.error("[billing] Google Play notification could not be reconciled");
    return NextResponse.json({ error: "Reconciliation temporarily unavailable" }, { status: 503 });
  }
}

export const POST = observedRoute(observed_POST);
