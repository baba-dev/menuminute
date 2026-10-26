import { sql, and, eq } from "drizzle-orm";
import { z } from "zod";
import { restaurants } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { domainError } from "@/modules/organizations/service";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
const optional = (max: number) => z.string().trim().max(max).nullable();
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((v) => v.toLowerCase());
export const outletProfileFieldsSchema = z
  .object({
    description: optional(500),
    phone: optional(40),
    email: z
      .union([z.email().max(254), z.literal(""), z.null()])
      .transform((v) => (v ? v.toLowerCase() : null)),
    website: z
      .union([
        z
          .url()
          .max(512)
          .refine((v) => /^https?:\/\//i.test(v), "Use HTTP(S)"),
        z.literal(""),
        z.null(),
      ])
      .transform((v) => v || null),
    addressLine1: optional(180),
    addressLine2: optional(180),
    city: optional(100),
    state: optional(100),
    postalCode: optional(24),
    primaryColor: color,
    secondaryColor: color,
    pickupLeadMinutes: z.number().int().min(0).max(240),
    pickupSlotMinutes: z.number().int().min(5).max(120),
    pickupAdvanceDays: z.number().int().min(1).max(30),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .strict();
export const outletProfileCommandSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    fields: outletProfileFieldsSchema,
  })
  .strict();
export type OutletProfileFields = z.input<typeof outletProfileFieldsSchema>;
export function editableOutletProfile(row: typeof restaurants.$inferSelect): OutletProfileFields {
  return {
    description: row.description,
    phone: row.phone,
    email: row.email,
    website: row.website,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    primaryColor: row.primaryColor || "#f97316",
    secondaryColor: row.secondaryColor || "#1c1917",
    pickupLeadMinutes: row.pickupLeadMinutes,
    pickupSlotMinutes: row.pickupSlotMinutes,
    pickupAdvanceDays: row.pickupAdvanceDays,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
  };
}
export async function canManageOutletProfile(actor: Actor, outletId: string) {
  try {
    return await withOutlet(actor, outletId, "outlet.manage", async () => true);
  } catch (e) {
    if (e instanceof ForbiddenError) return false;
    throw e;
  }
}
export async function saveOutletProfile(
  actor: Actor,
  orgId: string,
  outletId: string,
  raw: unknown
) {
  const input = outletProfileCommandSchema.parse(raw);
  if (!orgId || !outletId) throw new NotFoundError("Outlet");
  try {
    return await withOutlet(actor, outletId, "outlet.manage", async (tx) => {
      const [match] = await tx
        .select({ id: restaurants.id })
        .from(restaurants)
        .where(and(eq(restaurants.id, outletId), eq(restaurants.organizationId, orgId)))
        .limit(1);
      if (!match) throw new NotFoundError("Outlet");
      const result = await tx.execute<{
        version: number;
      }>(sql`select app_private.update_outlet_profile(
   ${orgId},${outletId},${input.expectedVersion},${JSON.stringify(input.fields)}::jsonb
  ) as version`);
      const [latest] = await tx
        .select()
        .from(restaurants)
        .where(and(eq(restaurants.id, outletId), eq(restaurants.organizationId, orgId)))
        .limit(1);
      if (!latest) throw new NotFoundError("Outlet");
      return { profileVersion: result.rows[0]!.version, fields: editableOutletProfile(latest) };
    });
  } catch (e) {
    domainError(e);
  }
}
