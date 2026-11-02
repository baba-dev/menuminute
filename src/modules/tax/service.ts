import { sql } from "drizzle-orm";
import { z } from "zod";
import { ConflictError, ValidationError } from "@/lib/errors";
import { withOutlet, withOutletRead, type Actor } from "@/modules/tenancy/service";
import { salesTaxPolicySchema } from "./sales-tax";

const snapshotSchema = salesTaxPolicySchema.extend({
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  canChangeOrders: z.literal(false),
});
export type SalesTaxSettings = z.infer<typeof snapshotSchema>;

export const taxSettingsCommandSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    confirmed: z.literal(true),
    policy: salesTaxPolicySchema,
  })
  .strict();

export async function getOutletSalesTax(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<SalesTaxSettings> {
  return withOutletRead(actor, outletId, "menu.read", async (tx) => {
    const result = await tx.execute<{ profile: unknown }>(
      sql`select app_private.read_outlet_sales_tax(${organizationId},${outletId}) as profile`
    );
    return snapshotSchema.parse(result.rows[0]?.profile);
  });
}
export async function saveOutletSalesTax(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
): Promise<SalesTaxSettings> {
  const input = taxSettingsCommandSchema.parse(raw);
  try {
    return await withOutlet(actor, outletId, "outlet.manage", async (tx) => {
      const result = await tx.execute<{ profile: unknown }>(
        sql`select app_private.save_outlet_sales_tax(
          ${organizationId},${outletId},${input.expectedRevision},
          ${JSON.stringify({ ...input.policy, confirmed: true })}::jsonb
        ) as profile`
      );
      return snapshotSchema.parse(result.rows[0]?.profile);
    });
  } catch (error) {
    const inner = error instanceof Error && error.cause ? error.cause : error;
    const code =
      inner && typeof inner === "object" && "code" in inner ? String(inner.code) : null;
    if (code === "40001")
      throw new ConflictError("Tax settings changed elsewhere. Reload and review before saving.");
    if (code === "22023") throw new ValidationError("Invalid merchant tax settings");
    throw error;
  }
}
