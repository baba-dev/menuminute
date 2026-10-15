import { ValidationError } from "./errors";
/** Maintained ISO catalog from the Node/ICU runtime; no arbitrary currency strings. */
export function currencyExponent(currency: string): number | null {
  if (!Intl.supportedValuesOf("currency").includes(currency)) return null;
  return (
    new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? null
  );
}
export function displayToMinor(value: number | string, currency: string): number {
  const exponent = currencyExponent(currency);
  const text = String(value);
  if (exponent === null || !/^\d+(?:\.\d+)?$/.test(text))
    throw new ValidationError("Invalid money");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > exponent) throw new ValidationError("Price has fractional minor units");
  const minor =
    BigInt(whole!) * 10n ** BigInt(exponent) + BigInt(fraction.padEnd(exponent, "0") || "0");
  if (minor > 2147483647n)
    throw new ValidationError("Price exceeds supported numeric representation");
  return Number(minor);
}
