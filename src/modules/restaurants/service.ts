/**
 * Restaurant data access module.
 * All queries are tenant-scoped (always filter by restaurantId).
 * Never expose data across restaurant boundaries.
 */
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import { restaurants, restaurantMembers, qrCodes, restaurantSubscriptions } from "@/db/schema";
import type { Restaurant, RestaurantMember } from "@/db/schema";
import { slugify } from "@/lib/utils";
import { ForbiddenError } from "@/lib/errors";
import { generateMenuQrCode } from "@/modules/qr/service";

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getRestaurantByPublicId(publicId: string): Restaurant | undefined {
  const db = getDb();
  return db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.publicId, publicId), eq(restaurants.isActive, true)))
    .get();
}

export function getRestaurantById(id: string): Restaurant | undefined {
  const db = getDb();
  return db.select().from(restaurants).where(eq(restaurants.id, id)).get();
}

export function getRestaurantsByUserId(userId: string): Restaurant[] {
  const db = getDb();
  const members = db
    .select({ restaurantId: restaurantMembers.restaurantId })
    .from(restaurantMembers)
    .where(and(eq(restaurantMembers.userId, userId), eq(restaurantMembers.isActive, true)))
    .all();

  if (members.length === 0) return [];

  return members
    .map((m) => getRestaurantById(m.restaurantId))
    .filter((r): r is Restaurant => r != null);
}

export function getUserMembershipForRestaurant(
  userId: string,
  restaurantId: string
): RestaurantMember | undefined {
  const db = getDb();
  return db
    .select()
    .from(restaurantMembers)
    .where(
      and(
        eq(restaurantMembers.userId, userId),
        eq(restaurantMembers.restaurantId, restaurantId),
        eq(restaurantMembers.isActive, true)
      )
    )
    .get();
}

// ─── Authorization ────────────────────────────────────────────────────────────

export type RestaurantRole = "owner" | "manager" | "staff" | "kitchen";

export function assertRestaurantAccess(
  userId: string,
  restaurantId: string,
  requiredRoles: RestaurantRole[] = ["owner", "manager", "staff", "kitchen"]
): RestaurantMember {
  const membership = getUserMembershipForRestaurant(userId, restaurantId);

  if (!membership) {
    throw new ForbiddenError("You are not a member of this restaurant");
  }

  if (!requiredRoles.includes(membership.role as RestaurantRole)) {
    throw new ForbiddenError(`This action requires one of: ${requiredRoles.join(", ")}`);
  }

  return membership;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export type CreateRestaurantInput = {
  name: string;
  description?: string;
  city?: string;
  country?: string;
  currency?: string;
};

export async function createRestaurant(
  ownerId: string,
  input: CreateRestaurantInput
): Promise<Restaurant> {
  const db = getDb();
  const id = nanoid();
  const publicId = nanoid(12); // shorter stable token
  const slug = slugify(input.name);

  // Ensure slug uniqueness
  const existing = db
    .select({ id: restaurants.id })
    .from(restaurants)
    .where(eq(restaurants.slug, slug))
    .get();

  const finalSlug = existing ? `${slug}-${nanoid(4)}` : slug;

  const restaurant = db
    .insert(restaurants)
    .values({
      id,
      publicId,
      name: input.name,
      slug: finalSlug,
      description: input.description,
      city: input.city,
      country: input.country ?? "IN",
      currency: input.currency ?? "INR",
    })
    .returning()
    .get();

  // Create owner membership
  db.insert(restaurantMembers)
    .values({
      id: nanoid(),
      restaurantId: id,
      userId: ownerId,
      role: "owner",
      isActive: true,
      joinedAt: new Date(),
    })
    .run();

  // Create free plan subscription
  db.insert(restaurantSubscriptions)
    .values({
      id: nanoid(),
      restaurantId: id,
      planId: "plan-free",
      status: "active",
    })
    .run();

  // Generate initial QR code
  const qr = await generateMenuQrCode(publicId);
  db.insert(qrCodes)
    .values({
      id: nanoid(),
      restaurantId: id,
      purpose: "menu",
      label: "Main Menu QR",
      destinationToken: publicId,
      svgData: qr.svgData,
      isActive: true,
    })
    .run();

  return restaurant;
}

export function getRestaurantQrCodes(restaurantId: string) {
  const db = getDb();
  return db
    .select()
    .from(qrCodes)
    .where(and(eq(qrCodes.restaurantId, restaurantId), eq(qrCodes.isActive, true)))
    .all();
}

export function getDefaultOrActiveRestaurant(userId?: string): Restaurant | undefined {
  const db = getDb();

  if (userId) {
    const userRestaurants = getRestaurantsByUserId(userId);
    if (userRestaurants.length > 0 && userRestaurants[0]) {
      return userRestaurants[0];
    }
  }

  // Look for demo restaurant
  const demo = db
    .select()
    .from(restaurants)
    .where(eq(restaurants.publicId, "demo-spice-route-kitchen-v1"))
    .get();

  if (demo) return demo;

  // Fallback to any active restaurant
  return db.select().from(restaurants).where(eq(restaurants.isActive, true)).limit(1).get();
}
