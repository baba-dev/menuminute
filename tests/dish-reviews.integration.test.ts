import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { submitGuestOrder } from "../src/modules/orders/service";
import {
  guestReviewState,
  publicDishRatings,
  publicDishReviews,
  staffReviewAction,
  staffReviewQueue,
  submitGuestReview,
} from "../src/modules/reviews/service";
import { getPool } from "../src/db";
import { env } from "../src/lib/config/env";
import { dashboardNavigation } from "../src/modules/menu-product/dashboard-data";

async function outlet() {
  const f = await fixture();
  const menuId = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: {
      document: {
        name: "Review menu",
        currency: f.outlet.currency,
        categories: [
          { id: "food", name: "Food", items: [{ id: "plate", name: "Plate", priceMinor: 10000 }] },
        ],
      },
    },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  await admin(async (_db, pool) =>
    applyEntitlement(pool, {
      key: crypto.randomUUID(),
      organizationId: f.outlet.organizationId,
      operator: "reviews-test",
      reason: "Reviews integration",
      action: "grant",
      capability: "ordering.new",
      billingCurrency: "USD",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 3600000).toISOString(),
    })
  );
  return f;
}

async function placeOrder(f: Awaited<ReturnType<typeof outlet>>, served: boolean) {
  const placed = await submitGuestOrder(f.outlet.publicId, {
    clientSubmissionKey: crypto.randomUUID(),
    quotedTotalMinor: 10000,
    fulfillmentMode: "dine_in",
    items: [{ dishId: "plate", quantity: 1 }],
  });
  const item = await admin(async (_db, pool) => {
    if (served)
      await pool.query("update orders set status='served', updated_at=now() where id=$1", [
        placed.orderId,
      ]);
    return (await pool.query("select id from order_items where order_id=$1", [placed.orderId]))
      .rows[0].id as string;
  });
  return { ...placed, item, token: f.outlet.publicId };
}
const body = (
  o: { trackingToken: string; item: string; token: string },
  rating: number,
  extra = {}
) => ({
  token: o.token,
  trackingToken: o.trackingToken,
  orderItemId: o.item,
  rating,
  ...extra,
});

describe("verified dish reviews (migration 0103)", () => {
  it("opens only after the order is served, once per line, through the tracking capability", async () => {
    const f = await outlet();
    const early = await placeOrder(f, false);
    expect((await guestReviewState(early.token, early.orderId, early.trackingToken)).eligible).toBe(
      false
    );
    await expect(submitGuestReview(early.orderId, body(early, 5))).rejects.toMatchObject({
      statusCode: 422,
    });
    await admin(async (_db, pool) => {
      await pool.query("update orders set status='served', updated_at=now() where id=$1", [
        early.orderId,
      ]);
    });
    const state = await guestReviewState(early.token, early.orderId, early.trackingToken);
    expect(state.eligible).toBe(true);
    expect(state.items[0]).toMatchObject({ dishId: "plate", rating: null });

    const first = await submitGuestReview(
      early.orderId,
      body(early, 5, { comment: "Lovely", name: "Asha" })
    );
    expect(first.duplicate).toBe(false);
    const again = await submitGuestReview(early.orderId, body(early, 1));
    expect(again).toMatchObject({ duplicate: true, reviewId: first.reviewId });
    const after = await guestReviewState(early.token, early.orderId, early.trackingToken);
    expect(after.items[0]).toMatchObject({ rating: 5, commentStatus: "pending" });
    await admin(async (_db, pool) => {
      const agg = (
        await pool.query(
          "select rating_count,rating_sum from dish_rating_aggregates where outlet_id=$1",
          [f.outlet.id]
        )
      ).rows[0];
      expect(agg).toEqual({ rating_count: 1, rating_sum: 5 });
    });

    // Wrong capability, wrong order item and out-of-range ratings are rejected.
    await expect(
      submitGuestReview(early.orderId, { ...body(early, 4), trackingToken: "x".repeat(24) })
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(submitGuestReview(early.orderId, body(early, 6))).rejects.toThrow();
    await expect(getPool().query("select * from dish_reviews")).rejects.toThrow();
  });

  it("shows public stars only from three ratings and publishes comments only after approval", async () => {
    const f = await outlet();
    const orders = [
      await placeOrder(f, true),
      await placeOrder(f, true),
      await placeOrder(f, true),
    ];
    await submitGuestReview(
      orders[0]!.orderId,
      body(orders[0]!, 5, { comment: "Great plate", name: "Asha" })
    );
    await submitGuestReview(orders[1]!.orderId, body(orders[1]!, 4));
    expect(await publicDishRatings(f.outlet.publicId)).toEqual({});
    await submitGuestReview(orders[2]!.orderId, body(orders[2]!, 3));
    expect(await publicDishRatings(f.outlet.publicId)).toEqual({ plate: { count: 3, average: 4 } });

    // The comment is invisible until a manager approves it.
    expect(await publicDishReviews(f.outlet.publicId, "plate")).toEqual([]);
    const queue = await staffReviewQueue(f.actor, f.outlet.organizationId, f.outlet.id);
    const pending = queue.find((r) => r.commentStatus === "pending")!;
    expect(pending).toMatchObject({ comment: "Great plate", rating: 5, dishName: "Plate" });
    await staffReviewAction(f.actor, f.outlet.organizationId, f.outlet.id, {
      reviewId: pending.id,
      action: "publish_comment",
    });
    expect(await publicDishReviews(f.outlet.publicId, "plate")).toMatchObject([
      { rating: 5, comment: "Great plate", name: "Asha" },
    ]);
    await staffReviewAction(f.actor, f.outlet.organizationId, f.outlet.id, {
      reviewId: pending.id,
      action: "hide_comment",
    });
    expect(await publicDishReviews(f.outlet.publicId, "plate")).toEqual([]);

    // Removing a rating updates the aggregate and it drops back below the public threshold.
    await staffReviewAction(f.actor, f.outlet.organizationId, f.outlet.id, {
      reviewId: pending.id,
      action: "remove",
    });
    expect(await publicDishRatings(f.outlet.publicId)).toEqual({});

    // Another tenant's manager cannot read or moderate this outlet's reviews.
    const other = await fixture();
    await expect(
      staffReviewQueue(other.actor, f.outlet.organizationId, f.outlet.id)
    ).rejects.toThrow();
    await expect(
      staffReviewAction(other.actor, f.outlet.organizationId, f.outlet.id, {
        reviewId: pending.id,
        action: "remove",
      })
    ).rejects.toThrow();
  });

  it("refuses the public demo tenant", async () => {
    const f = await outlet();
    const order = await placeOrder(f, true);
    await admin(async (_db, pool) => {
      await pool.query("update restaurants set is_demo_data=true where id=$1", [f.outlet.id]);
    });
    await expect(submitGuestReview(order.orderId, body(order, 5))).rejects.toMatchObject({
      statusCode: 422,
    });
    expect((await guestReviewState(order.token, order.orderId, order.trackingToken)).eligible).toBe(
      false
    );
  });

  it("offers the moderation destination to an outlet manager only while the flag is on", async () => {
    const f = await outlet();
    const flag = env as { PUBLIC_DINER_REVIEWS_ENABLED: boolean };
    const before = flag.PUBLIC_DINER_REVIEWS_ENABLED;
    try {
      flag.PUBLIC_DINER_REVIEWS_ENABLED = false;
      expect(
        (await dashboardNavigation(f.actor, f.outlet.organizationId, f.outlet.id)).reviews
      ).toBe(false);
      flag.PUBLIC_DINER_REVIEWS_ENABLED = true;
      expect(
        (await dashboardNavigation(f.actor, f.outlet.organizationId, f.outlet.id)).reviews
      ).toBe(true);
    } finally {
      flag.PUBLIC_DINER_REVIEWS_ENABLED = before;
    }
  });
});
