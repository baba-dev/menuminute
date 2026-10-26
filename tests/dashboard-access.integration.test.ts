import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { fixture, admin } from "./helpers";
import { applyEntitlement } from "@/modules/billing/operator";
import { organizationMembers, outletGrants } from "@/db/schema";
import {
  dashboardMenuRows,
  dashboardNavigation,
  dashboardQrRows,
} from "@/modules/menu-product/dashboard-data";

describe("dashboard authorization and lightweight projections", () => {
  it("keeps projection fields minimal and rejects cross-tenant reads", async () => {
    const owner = await fixture();
    const outsider = await fixture();
    const qrs = await dashboardQrRows(owner.actor.userId, owner.outlet.id);
    expect(qrs.length).toBeGreaterThan(0);
    expect(qrs[0]).toHaveProperty("destinationToken");
    expect(qrs[0]).not.toHaveProperty("svgData");
    const menus = await dashboardMenuRows(owner.actor.userId, owner.outlet.id);
    for (const menu of menus) {
      expect(Object.keys(menu).sort()).toEqual(["archived", "publishedRevision", "revision"]);
    }
    await expect(dashboardQrRows(outsider.actor.userId, owner.outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(dashboardMenuRows(outsider.actor.userId, owner.outlet.id)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(
      dashboardNavigation(outsider.actor, owner.outlet.organizationId, owner.outlet.id)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("separates active organization grants from outlet role permissions and honors revocation", async () => {
    const owner = await fixture();
    const editor = await fixture();
    const org = owner.outlet.organizationId;
    const outletId = owner.outlet.id;
    const memberId = nanoid();
    await admin(async (db, pool) => {
      await db.insert(organizationMembers).values({
        id: memberId,
        organizationId: org,
        userId: editor.actor.userId,
        role: "member",
      });
      await db.insert(outletGrants).values({
        organizationId: org,
        memberId,
        outletId,
        roles: ["menu_editor"],
      });
      for (const capability of ["ordering.new", "kitchen.new"] as const) {
        await applyEntitlement(pool, {
          key: crypto.randomUUID(),
          organizationId: org,
          operator: "dashboard-test-operator",
          reason: "Dashboard role matrix test",
          action: "grant",
          capability,
          billingCurrency: "USD",
          startsAt: new Date(Date.now() - 60_000).toISOString(),
          endsAt: new Date(Date.now() + 3_600_000).toISOString(),
        });
      }
    });
    expect(await dashboardNavigation(owner.actor, org, outletId)).toEqual({
      ordering: true,
      kitchen: true,
      ordersRead: true,
      kitchenRead: true,
    });
    expect(await dashboardNavigation(editor.actor, org, outletId)).toEqual({
      ordering: true,
      kitchen: true,
      ordersRead: false,
      kitchenRead: false,
    });
    await admin(async (db) => {
      await db
        .update(outletGrants)
        .set({ roles: ["menu_editor", "kitchen"] })
        .where(eq(outletGrants.memberId, memberId));
    });
    expect(await dashboardNavigation(editor.actor, org, outletId)).toMatchObject({
      ordersRead: true,
      kitchenRead: true,
    });
    await admin(async (db) => {
      await db
        .update(organizationMembers)
        .set({ isActive: false })
        .where(eq(organizationMembers.id, memberId));
    });
    await expect(dashboardNavigation(editor.actor, org, outletId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
