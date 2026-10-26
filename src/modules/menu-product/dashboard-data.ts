import { cache } from "react";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { menuAssignments, menus, qrCodes, restaurants } from "@/db/schema";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { publicProduct } from "@/modules/menu-product/service";
import type { MenuQr, MenuRow } from "@/modules/menu-product/dashboard-summary";

/**
 * Read-only dashboard projection: deliberately excludes menu JSON, QR SVG and
 * historical revisions. PostgreSQL RLS and lock_outlet remain authoritative.
 * React cache deduplicates matching reads in the layout and page per request,
 * never between authenticated users or requests.
 */
export const dashboardMenuRows = cache(async (userId: string, outletId: string): Promise<MenuRow[]> => {
  return withOutlet({ userId }, outletId, "menu.read", (tx) =>
    tx
      .select({
        archived: menus.archived,
        revision: menus.revision,
        publishedRevision: menus.publishedRevision,
      })
      .from(menus)
      .leftJoin(
        menuAssignments,
        and(eq(menuAssignments.menuId, menus.id), eq(menuAssignments.outletId, outletId))
      )
      .where(or(eq(menus.outletId, outletId), eq(menuAssignments.outletId, outletId)))
  );
});

export const dashboardQrRows = cache(async (userId: string, outletId: string): Promise<MenuQr[]> => {
  return withOutlet({ userId }, outletId, "menu.read", (tx) =>
    tx
      .select({
        id: qrCodes.id,
        destinationToken: qrCodes.destinationToken,
        purpose: qrCodes.purpose,
        isActive: qrCodes.isActive,
        tableId: qrCodes.tableId,
        createdAt: qrCodes.createdAt,
      })
      .from(qrCodes)
      .where(eq(qrCodes.restaurantId, outletId))
      .orderBy(asc(qrCodes.createdAt), asc(qrCodes.id))
  );
});

export const dashboardPublicProjection = cache(async (destinationToken: string) => {
  // Retain the established versioned/legacy public projection semantics.
  return publicProduct(destinationToken);
});

export type DashboardNavigation = {
  ordering: boolean;
  kitchen: boolean;
  ordersRead: boolean;
  kitchenRead: boolean;
};

/**
 * Entitlements are organization capabilities, but navigation must also respect
 * outlet role permissions. Unlike billingState, this read is for any authorized
 * outlet member (not just the organization owner).
 */
export async function dashboardNavigation(actor: Actor, organizationId: string, outletId: string) {
  return withOutlet(actor, outletId, "menu.read", async (tx): Promise<DashboardNavigation> => {
    const [outlet] = await tx
      .select({ organizationId: restaurants.organizationId })
      .from(restaurants)
      .where(and(eq(restaurants.id, outletId), eq(restaurants.organizationId, organizationId)))
      .limit(1);
    if (!outlet) throw new Error("Dashboard outlet scope mismatch");
    const result = await tx.execute<{
      ordering: boolean;
      kitchen: boolean;
      ordersRead: boolean;
      kitchenRead: boolean;
    }>(sql`select
      app_private.entitlement_allowed(${organizationId}, 'ordering.new') as ordering,
      app_private.entitlement_allowed(${organizationId}, 'kitchen.new') as kitchen,
      app_private.can_outlet(${outletId}, 'orders.read') as "ordersRead",
      app_private.can_outlet(${outletId}, 'orders.prepare') as "kitchenRead"`);
    const status = result.rows[0];
    return {
      ordering: status?.ordering === true,
      kitchen: status?.kitchen === true,
      ordersRead: status?.ordersRead === true,
      kitchenRead: status?.kitchenRead === true,
    };
  });
}
