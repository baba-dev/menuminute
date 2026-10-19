import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { nanoid } from "nanoid";
import { users } from "../src/db/schema";
import { createRestaurant } from "../src/modules/restaurants/service";
export async function admin<T>(work: (db: ReturnType<typeof drizzle>, pool: Pool) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env["MIGRATION_DATABASE_URL"], max: 1 });
  try {
    return await work(drizzle(pool), pool);
  } finally {
    await pool.end();
  }
}
export async function fixture(currency = "INR") {
  const userId = nanoid();
  await admin(async (db) => {
    await db.insert(users).values({
      id: userId,
      email: `${userId}@test.invalid`,
      name: "Fixture Owner",
      emailVerified: true,
    });
  });
  const outlet = await createRestaurant(userId, {
    name: "Fixture Kitchen",
    country: "IN",
    currency,
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
  });
  return { actor: { userId }, outlet };
}
