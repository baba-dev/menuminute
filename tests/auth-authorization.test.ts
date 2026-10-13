import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { assertRestaurantAccess } from "../src/modules/restaurants/service";
import { ForbiddenError } from "../src/lib/errors";
import { getDb } from "../src/db";
import { restaurants, restaurantMembers, users } from "../src/db/schema";
import { nanoid } from "nanoid";

describe("Authentication & Authorization Boundaries", () => {
  it("should hash and verify passwords using bcrypt (12 rounds)", async () => {
    const password = "my-secure-restaurant-password-123";
    const hash = await bcrypt.hash(password, 12);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare("wrong-password", hash)).toBe(false);
  });

  it("should enforce tenant boundaries and role requirements", () => {
    const db = getDb();
    const userId = `user-role-test-${nanoid(6)}`;
    const restaurantId = `rest-role-test-${nanoid(6)}`;

    // Create user
    db.insert(users)
      .values({
        id: userId,
        email: `role-${nanoid(6)}@test.com`,
        name: "Staff Member",
        role: "user",
      })
      .run();

    // Create restaurant
    db.insert(restaurants)
      .values({
        id: restaurantId,
        publicId: `pub-role-${nanoid(6)}`,
        name: "Role Test Kitchen",
        slug: `role-test-kitchen-${nanoid(4)}`,
        currency: "INR",
      })
      .run();

    // User is NOT a member yet -> Should throw ForbiddenError
    expect(() => {
      assertRestaurantAccess(userId, restaurantId);
    }).toThrow(ForbiddenError);

    // Add user as "kitchen" role
    db.insert(restaurantMembers)
      .values({
        id: nanoid(),
        restaurantId,
        userId,
        role: "kitchen",
      })
      .run();

    // Kitchen staff CAN access kitchen/staff tasks
    expect(() => {
      assertRestaurantAccess(userId, restaurantId, ["kitchen", "staff"]);
    }).not.toThrow();

    // Kitchen staff CANNOT perform "owner" only actions (e.g. billing deletion)
    expect(() => {
      assertRestaurantAccess(userId, restaurantId, ["owner"]);
    }).toThrow(ForbiddenError);
  });
});
