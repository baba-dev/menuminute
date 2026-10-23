import { sql, eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { menus, menuAssignments, menuOverrides, dishMedia, menuReleases } from "@/db/schema";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";
import { getPool } from "@/db";
import { getPublicMenu, getRestaurantById } from "@/modules/restaurants/service";
import { getFullMenu } from "@/modules/menus/service";
import { domainError } from "@/modules/organizations/service";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { entityId, validateMenuCommand, menuDocumentSchema, type MenuDocument } from "./contracts";
import { organizationFromAuthorizedMenus } from "./dish-reuse";
import { artworkById } from "./dish-artwork";
export async function listMenus(actor: Actor, outletId: string) {
  await getRestaurantById(actor, outletId);
  return withActor(actor, async (tx) => {
    const rows = await tx.select().from(menus).orderBy(desc(menus.updatedAt));
    const assigned = await tx
      .select()
      .from(menuAssignments)
      .where(eq(menuAssignments.outletId, outletId));
    return rows.filter((m) => m.outletId === outletId || assigned.some((a) => a.menuId === m.id));
  });
}
/**
 * Organization reuse: permission is checked independently for the target outlet, target
 * menu and every source menu by the database's menu_read RLS policy. Never return
 * prices, descriptions, dietary flags or source-outlet media.
 */
export async function listReusableDishes(actor: Actor, outletId: string, menuId: string) {
  entityId.parse(menuId);
  const outlet = await getRestaurantById(actor, outletId);
  if (!outlet) throw new NotFoundError("Outlet");
  const targetMenus = await listMenus(actor, outletId);
  if (!targetMenus.some((m) => m.id === menuId)) throw new NotFoundError("Menu");
  return withOutlet(actor, outletId, "menu.read", async (tx) => {
    const rows = await tx
      .select({
        id: menus.id,
        document: menus.document,
        updatedAt: menus.updatedAt,
      })
      .from(menus)
      .where(and(eq(menus.organizationId, outlet.organizationId), eq(menus.archived, false)))
      .orderBy(desc(menus.updatedAt))
      .limit(40);
    // RLS still gates each source row via app_private.menu_access('menu.read').
    return organizationFromAuthorizedMenus(rows.filter((row) => row.id !== menuId));
  });
}
export async function menuDetail(actor: Actor, id: string) {
  return withActor(actor, async (tx) => {
    const row = (await tx.select().from(menus).where(eq(menus.id, id)))[0];
    if (!row) throw new NotFoundError("Menu");
    const allowed = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.menu_access(${id},'menu.write') as allowed`
    );
    const historicalRelease = await tx.select({ revision: menuReleases.revision }).from(menuReleases).where(eq(menuReleases.menuId, id)).limit(1);
    const assignments = await tx
      .select()
      .from(menuAssignments)
      .where(eq(menuAssignments.menuId, id));
    const overrides = await tx.select().from(menuOverrides).where(eq(menuOverrides.menuId, id));
    return {
      ...row,
      document: menuDocumentSchema.parse(row.document),
      canWrite: allowed.rows[0]?.allowed ?? false,
      everPublished: historicalRelease.length > 0,
      assignments,
      overrides,
    };
  });
}
export async function commandMenu(actor: Actor, outletId: string, id: string, raw: unknown) {
  entityId.parse(id);
  const input = validateMenuCommand(raw);
  if (input.action === "save" || input.action === "create") {
    const doc = input.data.document as MenuDocument;
    for (const category of doc.categories) for (const dish of category.items) {
      if (dish.artworkId && !artworkById(dish.artworkId))
        throw new ValidationError("Unknown curated dish illustration");
    }
  }
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: { menuId: string; revision: number } }>(
            sql`select app_private.menu_command(${outletId},${id},${input.action},${JSON.stringify(input.data)}::jsonb,${input.key},${input.expectedRevision}) as result`
          )
        ).rows[0]!.result
    );
  } catch (e) {
    const inner = e instanceof Error && e.cause ? e.cause : e;
    if (
      inner instanceof Error &&
      [
        "Variant prices cannot use a local base-price override",
        "Clear local base-price overrides before adding variants",
      ].includes(inner.message)
    )
      throw new ValidationError(inner.message);
    domainError(e);
  }
}
export async function defaultDocument(actor: Actor, outletId: string): Promise<MenuDocument> {
  const outlet = await getRestaurantById(actor, outletId);
  if (!outlet) throw new NotFoundError("Outlet");
  const old = await getFullMenu(actor, outletId);
  return menuDocumentSchema.parse({
    name: "Our menu",
    currency: outlet.currency,
    categories: old.map(({ category, items }) => ({
      id: category.id,
      name: category.name,
      description: category.description ?? "",
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? "",
        priceMinor: i.pricePaise,
        soldOut: !i.isAvailable,
        dietary: [
          ...(i.isVeg ? ["vegetarian"] : []),
          ...(i.isVegan ? ["vegan"] : []),
          ...(i.isGlutenFree ? ["gluten_free"] : []),
        ],
      })),
    })),
  });
}
export async function qrCommand(actor: Actor, outletId: string, raw: unknown) {
  const input = z
    .object({
      key: z.uuid(),
      action: z.enum(["create", "revoke", "regenerate"]),
      data: z
        .object({
          qrId: entityId.optional(),
          label: z.string().trim().min(1).max(80).optional(),
          pointLabel: z.string().trim().min(1).max(80).optional(),
        })
        .strict(),
    })
    .strict()
    .parse(raw);
  if (input.action !== "create" && !input.data.qrId)
    throw new ForbiddenError("QR identity is required");
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: { id: string; token?: string; revoked?: boolean } }>(
            sql`select app_private.qr_command(${outletId},${input.action},${JSON.stringify(input.data)}::jsonb,${input.key}) as result`
          )
        ).rows[0]!.result
    );
  } catch (e) {
    domainError(e);
  }
}
export async function mediaList(actor: Actor, outletId: string) {
  await getRestaurantById(actor, outletId);
  return withActor(actor, (tx) =>
    tx
      .select({
        id: dishMedia.id,
        status: dishMedia.status,
        approvedAt: dishMedia.approvedAt,
        lastError: dishMedia.lastError,
        width: dishMedia.width,
        height: dishMedia.height,
        createdAt: dishMedia.createdAt,
      })
      .from(dishMedia)
      .where(eq(dishMedia.outletId, outletId))
      .orderBy(desc(dishMedia.createdAt))
      .limit(100)
  );
}
export type PublicProduct = {
  outlet: {
    id: string;
    name: string;
    currency: string;
    orderingEnabled?: boolean;
    timezone: string;
    outletType: string;
    fulfillmentModes: string[];
    isDemoData: boolean;
    versioned: boolean;
  };
  point: string | null;
  catalogFingerprint: string;
  now: string;
  menus: {
    id: string;
    revision: number;
    brand: string | null;
    document: MenuDocument;
    overrides: { dishId: string; priceMinor: number | null; soldOut: boolean | null }[];
  }[];
};
export async function publicProduct(token: string): Promise<PublicProduct | null> {
  if (!z.string().min(1).max(128).safeParse(token).success) return null;
  const r = await getPool().query<{
    data: PublicProduct | null;
    fingerprint: string | null;
    ordering_enabled: boolean;
  }>(
    "with p as (select app_private.free_menu_public($1) as data) select data, md5((data->'menus')::text) as fingerprint, app_private.public_ordering_enabled($1) as ordering_enabled from p",
    [token]
  );
  const data = r.rows[0]?.data;
  if (data) {
    data.catalogFingerprint = r.rows[0]?.fingerprint ?? "";
    data.outlet.orderingEnabled = r.rows[0]?.ordering_enabled ?? false;
  }
  if (!data) return null;
  if (!data.outlet.versioned) {
    const legacy = await getPublicMenu(token);
    if (!legacy) return null;
    data.menus = [
      {
        id: "legacy",
        revision: 0,
        brand: null,
        overrides: [],
        document: menuDocumentSchema.parse({
          name: "Menu",
          currency: data.outlet.currency,
          categories: legacy.menu.map(({ category, items }) => ({
            id: category.id,
            name: category.name,
            description: category.description ?? "",
            items: items.map((i) => ({
              id: i.id,
              name: i.name,
              description: i.description ?? "",
              priceMinor: i.pricePaise,
              soldOut: !i.isAvailable,
              dietary: [
                ...(i.isVeg ? ["vegetarian"] : []),
                ...(i.isVegan ? ["vegan"] : []),
                ...(i.isGlutenFree ? ["gluten_free"] : []),
              ],
            })),
          })),
        }),
      },
    ];
  } else
    data.menus = data.menus.map((m) => ({ ...m, document: menuDocumentSchema.parse(m.document) }));
  // Public payload contains display data only; opaque identities remain internal to API/DOM as needed.
  data.menus = data.menus.map((m) => ({
    ...m,
    document: {
      ...m.document,
      categories: m.document.categories
        .filter((c) => !c.archived)
        .map((c) => ({ ...c, items: c.items.filter((i) => !i.archived) })),
    },
  }));
  return data;
}
