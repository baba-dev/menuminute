import { describe, it, expect } from "vitest";
import { sql, eq } from "drizzle-orm";
import { fixture, admin } from "./helpers";
import { getDb, getPool, verifyRuntimeRole } from "../src/db";
import { withActor, withOutlet } from "../src/modules/tenancy/service";
import {
  menuCategories,
  menuItems,
  organizationMembers,
  outletGrants,
  brandOutlets,
  brands,
} from "../src/db/schema";
import {
  createCategory,
  createMenuItem,
  getCategoriesByRestaurant,
  updateMenuItem,
} from "../src/modules/menus/service";
import {
  createRestaurant,
  getDefaultOrActiveRestaurant,
  getPublicMenu,
} from "../src/modules/restaurants/service";
import { nanoid } from "nanoid";
describe("PostgreSQL tenant boundaries", () => {
  it("uses a restricted non-owner role; missing actor context denies all tenant reads", async () => {
    await verifyRuntimeRole();
    expect(await getDb().select().from(menuCategories)).toEqual([]);
    expect(
      (await getPool().query("select current_setting('app.actor_id',true) as actor")).rows[0]
        .actor ?? ""
    ).toBe("");
  });
  it("denies cross-tenant services, raw SQL and composite category grafts", async () => {
    const a = await fixture(),
      b = await fixture();
    const ca = await createCategory(a.actor, a.outlet.id, { name: "Alpha" });
    const cb = await createCategory(b.actor, b.outlet.id, { name: "Beta" });
    expect((await getCategoriesByRestaurant(a.actor, a.outlet.id)).map((c) => c.id)).toContain(
      ca.id
    );
    await expect(getCategoriesByRestaurant(a.actor, b.outlet.id)).rejects.toThrow();
    const foreign = await withActor(a.actor, (tx) =>
      tx.select().from(menuCategories).where(eq(menuCategories.id, cb.id))
    );
    expect(foreign).toEqual([]);
    await expect(
      createMenuItem(a.actor, a.outlet.id, { categoryId: cb.id, name: "Grafted", priceRupees: 1 })
    ).rejects.toThrow();
  });
  it("clears pooled context on commit and rollback", async () => {
    const a = await fixture();
    await createCategory(a.actor, a.outlet.id, { name: "Scoped" });
    await withActor(a.actor, async (tx) => {
      expect((await tx.select().from(menuCategories)).length).toBeGreaterThan(0);
    });
    await expect(
      withActor(a.actor, async () => {
        throw new Error("rollback");
      })
    ).rejects.toThrow("rollback");
    expect(await getDb().select().from(menuCategories)).toEqual([]);
  });
  it("composes scoped roles and applies revocation on the next operation", async () => {
    const a = await fixture(),
      b = await fixture();
    const memberId = nanoid();
    await admin(async (db) => {
      await db.insert(organizationMembers).values({
        id: memberId,
        organizationId: a.outlet.organizationId,
        userId: b.actor.userId,
        role: "member",
      });
      await db.insert(outletGrants).values({
        organizationId: a.outlet.organizationId,
        memberId,
        outletId: a.outlet.id,
        roles: ["kitchen", "menu_editor"],
      });
    });
    await createCategory(b.actor, a.outlet.id, { name: "Allowed editor" });
    await expect(
      withOutlet(b.actor, a.outlet.id, "orders.accept", async () => true)
    ).rejects.toThrow();
    await withOutlet(b.actor, a.outlet.id, "orders.prepare", async () => true);
    await admin(async (db) => {
      await db
        .update(organizationMembers)
        .set({ isActive: false })
        .where(eq(organizationMembers.id, memberId));
    });
    await expect(createCategory(b.actor, a.outlet.id, { name: "Revoked" })).rejects.toThrow();
  });
  it("rejects cross-organization brand/outlet assignments at the database", async () => {
    const a = await fixture(),
      b = await fixture();
    await expect(
      admin(async (db) => {
        await db.insert(brandOutlets).values({
          organizationId: a.outlet.organizationId,
          brandId: `brand-${a.outlet.id}`,
          outletId: b.outlet.id,
        });
      })
    ).rejects.toThrow();
    expect(
      await withActor(b.actor, (tx) =>
        tx.select().from(brands).where(eq(brands.organizationId, a.outlet.organizationId))
      )
    ).toEqual([]);
  });
  it("private selection never falls back to demo and public projection exposes only published fields", async () => {
    expect(await getDefaultOrActiveRestaurant()).toBeUndefined();
    expect(await getDefaultOrActiveRestaurant("unknown")).toBeUndefined();
    const a = await fixture();
    expect(await getPublicMenu(a.outlet.publicId)).toBeNull();
    await admin(async (_db, pool) => {
      await pool.query(
        "update restaurants set is_published=true,email='private@test.invalid' where id=$1",
        [a.outlet.id]
      );
    });
    const p = await getPublicMenu(a.outlet.publicId);
    expect(p?.restaurant.name).toBe(a.outlet.name);
    expect(p?.restaurant).not.toHaveProperty("email");
    expect(p?.restaurant).not.toHaveProperty("organizationId");
  });
  it("rolls back business mutations atomically", async () => {
    const a = await fixture();
    const category = await createCategory(a.actor, a.outlet.id, { name: "Atomic" });
    const item = await createMenuItem(a.actor, a.outlet.id, {
      categoryId: category.id,
      name: "Dish",
      priceRupees: 3,
    });
    await expect(
      withOutlet(a.actor, a.outlet.id, "menu.write", async (tx) => {
        await tx.update(menuItems).set({ name: "Uncommitted" }).where(eq(menuItems.id, item.id));
        await tx.execute(sql`select 1/0`);
      })
    ).rejects.toThrow();
    expect(
      (await updateMenuItem(a.actor, item.id, a.outlet.id, { description: "Still present" })).name
    ).toBe("Dish");
  });
});

it("reconciles uncertain provisioning retries and rejects key payload conflicts", async () => {
  const a = await fixture();
  const key = crypto.randomUUID();
  const input = {
    name: "Retry Kitchen",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant" as const,
  };
  const first = await createRestaurant(a.actor.userId, input, key);
  const retry = await createRestaurant(a.actor.userId, input, key);
  expect(retry.id).toBe(first.id);
  await expect(
    createRestaurant(a.actor.userId, { ...input, name: "Different Kitchen" }, key)
  ).rejects.toThrow();
});
