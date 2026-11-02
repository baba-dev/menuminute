import { sql } from "drizzle-orm";
import { z } from "zod";
import { getPool } from "@/db";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { withActor, withOutletRead, type Actor } from "@/modules/tenancy/service";

/** A dish shows public stars only once this many verified ratings exist. */
export const REVIEW_MIN_PUBLIC_COUNT = 3;

const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const token = identity;
const trackingToken = z.string().min(12).max(128);

export const reviewSubmitSchema = z
  .object({
    token,
    trackingToken,
    orderItemId: identity,
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(400).default(""),
    name: z.string().trim().max(40).default(""),
  })
  .strict();
export const reviewActionSchema = z
  .object({
    reviewId: z.string().uuid(),
    action: z.enum(["publish_comment", "hide_comment", "remove"]),
  })
  .strict();

export type ReviewLine = {
  orderItemId: string;
  dishId: string;
  name: string;
  rating: number | null;
  comment: string | null;
  commentStatus: "none" | "pending" | "published" | "hidden" | null;
};
export type ReviewState = { eligible: boolean; items: ReviewLine[] };
export type DishRatings = Record<string, { count: number; average: number }>;
export type PublicReview = { rating: number; comment: string; name: string; at: string };
export type StaffReview = {
  id: string;
  dishId: string;
  dishName: string;
  rating: number;
  comment: string;
  name: string;
  commentStatus: "none" | "pending" | "published" | "hidden";
  createdAt: string;
};

function mapError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  if (code === "42501") throw new NotFoundError("Order");
  if (code === "22023") throw new ValidationError(message || "Invalid review");
  throw error;
}

export async function guestReviewState(
  tokenValue: string,
  orderId: string,
  tracking: string
): Promise<ReviewState> {
  identity.parse(orderId);
  token.parse(tokenValue);
  trackingToken.parse(tracking);
  try {
    const result = await getPool().query<{ data: ReviewState }>(
      "select app_private.guest_review_state($1,$2,$3) as data",
      [tokenValue, orderId, tracking]
    );
    return result.rows[0]!.data;
  } catch (error) {
    return mapError(error);
  }
}

export async function submitGuestReview(orderId: string, raw: unknown) {
  identity.parse(orderId);
  const input = reviewSubmitSchema.parse(raw);
  try {
    const result = await getPool().query<{ data: { reviewId: string; duplicate: boolean } }>(
      "select app_private.guest_review_submit($1,$2,$3,$4,$5,$6,$7) as data",
      [
        input.token,
        orderId,
        input.trackingToken,
        input.orderItemId,
        input.rating,
        input.comment,
        input.name,
      ]
    );
    return result.rows[0]!.data;
  } catch (error) {
    return mapError(error);
  }
}

export async function publicDishRatings(tokenValue: string): Promise<DishRatings> {
  token.parse(tokenValue);
  const result = await getPool().query<{ data: DishRatings }>(
    "select app_private.public_dish_ratings($1,$2) as data",
    [tokenValue, REVIEW_MIN_PUBLIC_COUNT]
  );
  return result.rows[0]?.data ?? {};
}

export async function publicDishReviews(tokenValue: string, dishId: string) {
  token.parse(tokenValue);
  identity.parse(dishId);
  const result = await getPool().query<{ data: PublicReview[] }>(
    "select app_private.public_dish_reviews($1,$2) as data",
    [tokenValue, dishId]
  );
  return result.rows[0]?.data ?? [];
}

export async function staffReviewQueue(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<StaffReview[]> {
  identity.parse(organizationId);
  identity.parse(outletId);
  return withOutletRead(actor, outletId, "outlet.manage", async (tx) => {
    const result = await tx.execute<{ data: StaffReview[] }>(
      sql`select app_private.staff_review_queue(${organizationId},${outletId}) as data`
    );
    return result.rows[0]?.data ?? [];
  });
}

export async function staffReviewAction(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  identity.parse(organizationId);
  identity.parse(outletId);
  const input = reviewActionSchema.parse(raw);
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const result = await tx.execute<{ data: { id: string; status: string } }>(
      sql`select app_private.staff_review_action(${organizationId},${outletId},${input.reviewId},${input.action}) as data`
    );
    return result.rows[0]?.data;
  });
}
