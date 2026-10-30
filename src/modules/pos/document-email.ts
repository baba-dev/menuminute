import { z } from "zod";

const minor = z.string().regex(/^(0|[1-9][0-9]{0,12})$/);
const line = z
  .object({
    name: z.string().min(1).max(500),
    variant: z.string().nullable().optional(),
    quantity: z.number().int().positive().max(9999),
    totalMinor: minor,
  })
  .passthrough();
const party = z
  .object({
    legalName: z.string().optional(),
    registeredAddress: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();
const snapshotSchema = z
  .object({
    bill: z
      .object({
        currency: z.string().regex(/^[A-Z]{3}$/),
        subtotalMinor: minor,
        taxMinor: minor,
        totalMinor: minor,
        lines: z.array(line).min(1).max(500),
        seller: party.optional(),
        customer: party.optional(),
      })
      .passthrough(),
    legalStatus: z.string().max(128).optional(),
  })
  .passthrough();

// Use only the immutable document snapshot, never the current mutable menu.
const clean = (value: string) =>
  value
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 500);
function money(minorUnits: string, currency: string): string {
  try {
    const options = { style: "currency" as const, currency, currencyDisplay: "code" as const };
    const digits = new Intl.NumberFormat("en-US", options).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat("en-US", {
      ...options,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(Number(minorUnits) / 10 ** digits);
  } catch {
    // Unknown historical currency: do not silently assume a two-decimal exponent.
    return minorUnits + " minor units (" + currency + ")";
  }
}

export function formatFinancialDocumentEmail(input: {
  documentNumber: string;
  kind: string;
  snapshot: unknown;
}): string {
  const heading = [
    "MenuMinute — merchant financial document",
    "Document: " + clean(input.documentNumber),
    "Type: " + clean(input.kind),
  ];
  const parsed = snapshotSchema.safeParse(input.snapshot);
  if (!parsed.success) {
    return [
      ...heading,
      "",
      "A complete document snapshot could not be formatted for email.",
      "Open the authorized private Ledger to view the original record.",
      "This message is not proof of bank settlement or government fiscal registration.",
    ].join("\n");
  }
  const { bill, legalStatus } = parsed.data;
  const currency = bill.currency;
  const lines = bill.lines.map(
    (item) =>
      String(item.quantity) +
      " × " +
      clean(item.name) +
      (item.variant ? " (" + clean(item.variant) + ")" : "") +
      " — " +
      money(item.totalMinor, currency)
  );
  return [
    ...heading,
    ...(bill.seller?.legalName ? ["Seller: " + clean(bill.seller.legalName)] : []),
    ...(bill.seller?.registeredAddress
      ? ["Seller address: " + clean(bill.seller.registeredAddress)]
      : []),
    ...(bill.customer?.name ? ["Customer: " + clean(bill.customer.name)] : []),
    ...(legalStatus ? ["Legal status: " + clean(legalStatus)] : []),
    "",
    "Items",
    ...lines,
    "",
    "Subtotal: " + money(bill.subtotalMinor, currency),
    "Tax shown: " + money(bill.taxMinor, currency),
    "Total billed: " + money(bill.totalMinor, currency),
    "",
    "This record is not proof of bank settlement or government fiscal registration.",
  ].join("\n");
}
