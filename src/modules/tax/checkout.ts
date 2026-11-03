import { z } from "zod";
import { getPool } from "@/db";
import { ConflictError } from "@/lib/errors";
import { previewMerchantSalesTax, type SalesTaxPolicy, type TaxQuote } from "./sales-tax";

/** Publicly safe, QR-token-scoped fields only; never reveal supplier registration. */
export const checkoutTaxPolicySchema = z
  .object({
    revision: z.number().int().nonnegative(),
    status: z.enum(["unconfigured", "no_tax", "configured"]),
    label: z.string().min(2).max(40),
    rateBps: z.number().int().min(0).max(10_000),
    inclusive: z.boolean(),
    applied: z.boolean(),
    currency: z.string().length(3),
  })
  .strict();
export type CheckoutTaxPolicy = z.infer<typeof checkoutTaxPolicySchema>;

export async function publicCheckoutTaxPolicy(token: string): Promise<CheckoutTaxPolicy> {
  const query = await getPool().query<{ result: unknown }>(
    "select app_private.public_order_tax_policy($1) as result",
    [token]
  );
  return checkoutTaxPolicySchema.parse(query.rows[0]?.result);
}

export function calculateCheckoutTax(
  currency: string,
  lineAmountsMinor: readonly string[],
  policy: CheckoutTaxPolicy
): TaxQuote {
  if (policy.currency !== currency)
    throw new ConflictError("The restaurant currency changed. Reload its menu.");
  const effective: SalesTaxPolicy = {
    status: policy.applied ? "configured" : "no_tax",
    label: policy.label,
    rateBps: policy.applied ? policy.rateBps : 0,
    inclusive: policy.inclusive,
  };
  return previewMerchantSalesTax(currency, lineAmountsMinor, effective);
}

export function requireCheckoutRevision(requested: number | undefined, current: CheckoutTaxPolicy) {
  if (
    (current.applied && requested === undefined) ||
    (requested !== undefined && requested !== current.revision)
  )
    throw new ConflictError("The restaurant's tax configuration changed. Review your new total.");
}
