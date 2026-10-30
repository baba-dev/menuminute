/** Shared, bounded minor-unit arithmetic for POS operations.
 * No floats, currency conversions, tax-policy approvals or fiscal side effects.
 */
import { currencyExponent } from "@/lib/money";

export const MAX_POS_MINOR = 2147483647n;
const MINOR_PATTERN = /^(0|[1-9][0-9]*)$/;

export function checkedMinor(value: string, name = "amount"): bigint {
  if (!MINOR_PATTERN.test(value)) throw new Error(`Invalid ${name} minor units`);
  const units = BigInt(value);
  if (units > MAX_POS_MINOR) throw new Error(`${name} exceeds POS amount limit`);
  return units;
}

/** Decimal input parsing with ISO zero-, two- and three-decimal precision. */
export function decimalToMinor(value: string, currency: string): string {
  const exponent = currencyExponent(currency);
  if (exponent === null || !/^(0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value))
    throw new Error("Invalid currency or decimal amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > exponent) throw new Error("Fractional minor units");
  return checkedMinor(
    (BigInt(whole!) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0")).toString()
  ).toString();
}

export type AllocationInput = {
  method: "cash" | "card_external" | "upi_external" | "bank_external";
  amountMinor: string;
  tenderedMinor: string;
  reference: string | null;
};

/** Validate the same money invariants enforced by restricted SQL tender commands. */
export function validateTender(input: AllocationInput): { changeMinor: string } {
  const applied = checkedMinor(input.amountMinor, "allocation");
  const tendered = checkedMinor(input.tenderedMinor, "tendered");
  if (applied === 0n || tendered < applied) throw new Error("Invalid tender allocation");
  if (input.method === "cash") {
    if (input.reference !== null) throw new Error("Cash cannot carry an external reference");
    return { changeMinor: (tendered - applied).toString() };
  }
  if (tendered !== applied || !input.reference || input.reference.trim().length < 3 ||
      input.reference.length > 80)
    throw new Error("External tender requires matching amount and reference");
  return { changeMinor: "0" };
}

function roundHalfUp(numerator: bigint, divisor: bigint): bigint {
  return (numerator * 2n + divisor) / (divisor * 2n);
}

/** Generic integer arithmetic only; NOT a legally approved tax classification. */
export function genericTax(amountMinor: string, rateBps: number, inclusive: boolean) {
  const amount = checkedMinor(amountMinor);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000)
    throw new Error("Invalid generic rate");
  const rate = BigInt(rateBps);
  const base = inclusive ? roundHalfUp(amount * 10000n, 10000n + rate) : amount;
  const tax = inclusive ? amount - base : roundHalfUp(base * rate, 10000n);
  const total = base + tax;
  if (total > MAX_POS_MINOR) throw new Error("Generic tax total exceeds POS limit");
  return { baseMinor: base.toString(), taxMinor: tax.toString(), totalMinor: total.toString() };
}

/** Deterministic largest-remainder distribution. Source lines are never modified. */
export function allocateDiscount(subtotalsMinor: string[], discountMinor: string): string[] {
  if (!subtotalsMinor.length || subtotalsMinor.length > 500)
    throw new Error("At least one bounded line is required");
  const subtotals = subtotalsMinor.map((v) => checkedMinor(v));
  const discount = checkedMinor(discountMinor, "discount");
  const subtotal = subtotals.reduce((sum, v) => sum + v, 0n);
  if (subtotal === 0n || discount > subtotal) throw new Error("Discount exceeds subtotal");
  const floors = subtotals.map((v) => (v * discount) / subtotal);
  const remainders = subtotals.map((v, index) => ({
    index, remainder: (v * discount) % subtotal,
  }));
  let spare = discount - floors.reduce((sum, v) => sum + v, 0n);
  remainders.sort((a, b) =>
    a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1
  );
  for (const { index } of remainders) {
    if (spare === 0n) break;
    floors[index]! += 1n;
    spare -= 1n;
  }
  return floors.map((v) => v.toString());
}
