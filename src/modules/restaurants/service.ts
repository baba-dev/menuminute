import { scheduleSchema } from "@/modules/menu-product/contracts";
import { readWorkspacePreference } from "@/modules/organizations/workspace-preferences";
import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { z } from "zod";
import { restaurantTables, restaurants, qrCodes } from "@/db/schema";
import { getPool } from "@/db";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";
import { generateMenuQrCode } from "@/modules/qr/service";
import { currencyExponent } from "@/lib/money";
export const createRestaurantSchema = z.object({
  fulfillmentModes: z
    .array(z.enum(["dine_in", "pickup"]))
    .min(1)
    .max(2)
    .optional(),
  menuSchedule: scheduleSchema.nullable().optional(),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().regex(/^[A-Z]{2}$/),
  currency: z.string().refine((v) => currencyExponent(v) !== null, "Unsupported currency"),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Invalid IANA timezone"),
  outletType: z.enum(["restaurant", "cafe", "takeout", "cloud_kitchen", "hotel", "mixed"]),
});
export type CreateRestaurantInput = z.input<typeof createRestaurantSchema>;
export async function getRestaurantsByUserId(userId: string) {
  return withActor({ userId }, (tx) =>
    tx.select().from(restaurants).where(eq(restaurants.isActive, true)).orderBy(asc(restaurants.id))
  );
}
/** Member-only selection: absent memberships return undefined, never a public demo. */
export async function getDefaultOrActiveRestaurant(userId?: string, activeOutletId?: string) {
  if (!userId) return undefined;
  const outlets = await getRestaurantsByUserId(userId);
  const preference = await readWorkspacePreference(userId);
  // Database preference wins across devices; cookie is only a legacy fallback.
  // Match both fields against fresh tenant-scoped active outlets.
  return (
    outlets.find(
      (o) => o.id === preference?.outletId && o.organizationId === preference.organizationId
    ) ??
    (preference?.organizationId
      ? outlets.find((o) => o.organizationId === preference.organizationId)
      : undefined) ??
    (!preference ? outlets.find((o) => o.id === activeOutletId) : undefined) ??
    outlets[0]
  );
}
export async function getRestaurantById(actor: Actor, id: string) {
  return withOutlet(
    actor,
    id,
    "menu.read",
    async (tx) => (await tx.select().from(restaurants).where(eq(restaurants.id, id)))[0]
  );
}
export async function createRestaurant(
  ownerId: string,
  raw: CreateRestaurantInput,
  requestKey = nanoid(32)
) {
  const input = createRestaurantSchema.parse(raw);
  const id = createHash("sha256")
    .update(ownerId + ":" + requestKey)
    .digest("hex");
  const publicId = createHash("sha256")
    .update("public:" + ownerId + ":" + requestKey)
    .digest("hex")
    .slice(0, 32);
  const qr = await generateMenuQrCode(publicId);
  await withActor({ userId: ownerId }, async (tx) => {
    await tx.execute(
      sql`select app_private.provision_organization(${id},${publicId},${JSON.stringify({ ...input, svgData: qr.svgData })}::jsonb)`
    );
  });
  const result = await getRestaurantById({ userId: ownerId }, id);
  if (!result) throw new Error("Provisioning failed");
  return result;
}
export async function getRestaurantQrCodes(actor: Actor, id: string) {
  return withOutlet(actor, id, "menu.read", (tx) =>
    tx
      .select({
        ...getTableColumns(qrCodes),
        pointLabel: restaurantTables.label,
      })
      .from(qrCodes)
      .leftJoin(
        restaurantTables,
        and(eq(qrCodes.tableId, restaurantTables.id), eq(restaurantTables.restaurantId, id))
      )
      .where(eq(qrCodes.restaurantId, id))
  );
}
export type PublicMenu = {
  restaurant: {
    id: string;
    publicId: string;
    name: string;
    description: string | null;
    phone: string | null;
    city: string | null;
    addressLine1: string | null;
    primaryColor: string | null;
    currency: string;
    isDemoData: boolean;
  };
  menu: Array<{
    category: { id: string; name: string; description: string | null };
    items: Array<{
      id: string;
      name: string;
      description: string | null;
      pricePaise: number;
      imageUrl: string | null;
      isVeg: boolean | null;
      isVegan: boolean | null;
      isGlutenFree: boolean | null;
      spiceLevel: number | null;
      isFeatured: boolean;
      isAvailable: boolean;
    }>;
  }>;
};
export async function getPublicMenu(token: string): Promise<PublicMenu | null> {
  if (token.length > 128) return null;
  const result = await getPool().query<{ projection: PublicMenu | null }>(
    "select app_private.public_menu($1) as projection",
    [token]
  );
  return result.rows[0]?.projection ?? null;
}
