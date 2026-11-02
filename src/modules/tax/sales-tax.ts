import { z } from "zod";
import { currencyExponent } from "@/lib/money";
import { ValidationError } from "@/lib/errors";

/**
 * Merchant-entered sales tax is a preference, not legal classification.
 * This pure arithmetic module does not authorize tax collection or fiscal issuance.
 * All amounts are integer minor-unit strings, never floating-point money.
 */
export const salesTaxPolicySchema = z
  .object({
    status: z.enum(["unconfigured", "no_tax", "configured"]),
    label: z.string().trim().min(2).max(40),
    rateBps: z.number().int().min(0).max(10_000),
    inclusive: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "configured" && value.rateBps === 0)
      ctx.addIssue({ code: "custom", path: ["rateBps"], message: "Enter a positive tax rate" });
    if (value.status !== "configured" && value.rateBps !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["rateBps"],
        message: "A no-tax declaration must not have a rate",
      });
  });
export type SalesTaxPolicy = z.infer<typeof salesTaxPolicySchema>;
export type TaxQuote = {
  currency: string;
  exponent: number;
  status: SalesTaxPolicy["status"];
  label: string;
  rateBps: number;
  inclusive: boolean;
  lineAmounts: { originalMinor: string; baseMinor: string; taxMinor: string; totalMinor: string }[];
  subtotalMinor: string;
  taxableBaseMinor: string;
  taxMinor: string;
  totalMinor: string;
  /** Present until a separately reviewed order/POS integration handles tax snapshots. */
  quotationOnly: true;
};
const MAX = 2_147_483_647n;
function minor(value: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new ValidationError("Invalid minor-unit amount");
  const n = BigInt(value);
  if (n > MAX) throw new ValidationError("Amount exceeds supported order limit");
  return n;
}
function roundedDivide(n: bigint, d: bigint) {
  return (n + d / 2n) / d;
}
/**
 * Per-line half-up rounding. Inclusive lines already include tax; exclusive
 * lines add it. This can be reused by an eventual server-authoritative cart,
 * POS and receipt pipeline, but must never be called to mutate historic bills.
 */
export function previewMerchantSalesTax(
  currency: string,
  lineAmountsMinor: readonly string[],
  input: SalesTaxPolicy
): TaxQuote {
  const policy = salesTaxPolicySchema.parse(input);
  const exponent = currencyExponent(currency);
  if (exponent === null) throw new ValidationError("Unsupported currency");
  if (lineAmountsMinor.length === 0 || lineAmountsMinor.length > 100)
    throw new ValidationError("Enter 1–100 order lines");
  const rate = BigInt(policy.status === "configured" ? policy.rateBps : 0);
  let subtotal = 0n;
  let baseTotal = 0n;
  let taxTotal = 0n;
  let grandTotal = 0n;
  const lines = lineAmountsMinor.map((value) => {
    const original = minor(value);
    const base =
      policy.inclusive && rate > 0n ? roundedDivide(original * 10_000n, 10_000n + rate) : original;
    const tax =
      policy.inclusive && rate > 0n ? original - base : roundedDivide(base * rate, 10_000n);
    const total = base + tax;
    subtotal += original;
    baseTotal += base;
    taxTotal += tax;
    grandTotal += total;
    if (grandTotal > MAX || subtotal > MAX)
      throw new ValidationError("Tax calculation exceeds supported order limit");
    return {
      originalMinor: String(original),
      baseMinor: String(base),
      taxMinor: String(tax),
      totalMinor: String(total),
    };
  });
  return {
    currency,
    exponent,
    status: policy.status,
    label: policy.label,
    rateBps: Number(rate),
    inclusive: policy.inclusive,
    lineAmounts: lines,
    subtotalMinor: String(subtotal),
    taxableBaseMinor: String(baseTotal),
    taxMinor: String(taxTotal),
    totalMinor: String(grandTotal),
    quotationOnly: true,
  };
}

/** Exact decimal percentage to basis points: 5 -> 500, 5.25 -> 525. */
export function percentToBasisPoints(value: string): number | null {
  if (!/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return result <= 10_000 ? result : null;
}
