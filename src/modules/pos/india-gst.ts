import { z } from "zod";
import { fiscalSourceSchema } from "./fiscal-readiness";

/**
 * India GST statutory *preparation* adapter.
 *
 * It cannot allocate a tax-invoice number, issue a document, post an IRP request,
 * generate a signed QR or change a POS order. Every value is for review only.
 * GSTIN syntax and declared tax treatments are never legal/authority verification.
 */
export const gstinSyntax = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const stateCode = z.string().regex(/^(?!00)[0-9]{2}$/, "Use a two-digit Indian state code");
const positiveMinor = z.string().regex(/^(0|[1-9][0-9]{0,9})$/);
const nonEmpty = (max: number) => z.string().trim().min(2).max(max);
const gstin = z
  .string()
  .regex(gstinSyntax, "GSTIN syntax is invalid; verify it with the authority");

export const indiaGstDraftInputSchema = z
  .object({
    saleId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    kind: z.enum(["tax_invoice_draft", "bill_of_supply_draft"]),
    supplyType: z.enum(["b2b", "b2c"]),
    placeOfSupplyStateCode: stateCode,
    reverseCharge: z.boolean(),
    // IRP classification depends on the taxpayer, transaction and effective law.
    // Never infer it from the bill amount or silently mark it exempt.
    irpDecision: z.enum(["undetermined", "required", "not_required"]),
    buyer: z
      .object({
        name: nonEmpty(160),
        address: nonEmpty(500),
        gstin: z.union([gstin, z.literal("")]),
        stateCode,
      })
      .strict(),
    lines: z
      .array(
        z
          .object({
            hsnSac: z.string().regex(/^\d{4,8}$/, "Enter a reviewed 4–8 digit HSN/SAC"),
            classification: z.enum(["goods", "services"]),
            unitCode: z.string().trim().min(1).max(12),
            rateBps: z.number().int().min(0).max(10000),
            cessBps: z.number().int().min(0).max(10000),
            componentMode: z.enum(["cgst_sgst", "cgst_utgst", "igst"]),
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();
export type IndiaGstDraftInput = z.infer<typeof indiaGstDraftInputSchema>;

export type GstDraftCheck = { id: string; satisfied: boolean; message: string };
export type GstDraftLine = {
  description: string;
  quantity: number;
  hsnSac: string;
  classification: "goods" | "services";
  unitCode: string;
  taxableBaseMinor: string;
  cgstMinor: string;
  sgstMinor: string;
  utgstMinor: string;
  igstMinor: string;
  cessMinor: string;
  taxMinor: string;
  totalMinor: string;
  ledgerTaxMinor: string;
  reconciled: boolean;
};
export type IndiaGstDraftReview = {
  mode: "india_gst_preissue_review";
  currency: string;
  saleId: string;
  documentType: "tax_invoice_draft" | "bill_of_supply_draft";
  issuingAuthorityVerified: false;
  irpVerified: false;
  statutoryIssuanceAllowed: false;
  serialAllocated: false;
  snapshotOnly: true;
  checks: GstDraftCheck[];
  issues: number;
  lines: GstDraftLine[];
  taxableBaseMinor: string;
  taxMinor: string;
  totalMinor: string;
  frozenBillTotalMinor: string;
  notice: string;
};
const MAX = 2147483647n;
function amount(value: unknown): bigint | null {
  if (typeof value !== "string" || !positiveMinor.safeParse(value).success) return null;
  const n = BigInt(value);
  return n <= MAX ? n : null;
}
function roundHalfUp(numerator: bigint, denominator: bigint) {
  return (numerator + denominator / 2n) / denominator;
}
const textValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * Source must come from app_private.pos_fiscal_readiness() through its
 * authorized outlet-scoped SQL definer. Client controls declarations only,
 * never seller identity, prices, frozen bill or tax amounts.
 */
export function reviewIndiaGstDraft(source: unknown, raw: unknown): IndiaGstDraftReview {
  const packet = fiscalSourceSchema.parse(source);
  const input = indiaGstDraftInputSchema.parse(raw);
  const checks: GstDraftCheck[] = [];
  const check = (id: string, satisfied: boolean, message: string) =>
    checks.push({ id, satisfied, message });
  const india =
    packet.country === "IN" &&
    packet.sellerCountry === "IN" &&
    packet.currency === "INR" &&
    packet.billCurrency === "INR";
  check(
    "jurisdiction",
    india,
    "Only Indian sellers and INR frozen bills are supported by this review; other countries need separate adapters."
  );
  check(
    "frozen_bill",
    packet.billFrozen &&
      packet.taxProfileRevision !== null &&
      input.saleId === packet.saleId &&
      packet.billTaxMode === "classified",
    "A matching, classified, immutable POS bill is required; ordinary receipts cannot become GST invoices."
  );
  const sellerGstin = packet.sellerTaxRegistration;
  check(
    "seller",
    packet.sellerRegime === "requires_review" &&
      gstinSyntax.test(sellerGstin) &&
      packet.sellerName.trim().length >= 2 &&
      packet.sellerAddress.trim().length >= 5,
    "Frozen registered seller details and a syntactically valid GSTIN are required; live GST registration must be independently verified."
  );
  check(
    "buyer",
    input.supplyType === "b2c" ? input.buyer.gstin === "" : gstinSyntax.test(input.buyer.gstin),
    "B2B requires buyer GSTIN; B2C must not be misrepresented as registered supply."
  );
  check(
    "buyer_state",
    input.supplyType === "b2c" || input.buyer.gstin.slice(0, 2) === input.buyer.stateCode,
    "Buyer GSTIN prefix must match the buyer's declared state; syntax is not authority validation."
  );
  check(
    "reverse_charge",
    !input.reverseCharge,
    "Reverse charge must be reviewed with a qualified tax adviser; no automatic self-assessed treatment is supported."
  );
  check(
    "no_exports",
    input.supplyType === "b2b" || input.supplyType === "b2c",
    "Exports and SEZ treatment require their own approved adapter."
  );
  check(
    "number_of_lines",
    packet.lines.length === input.lines.length,
    "Declarations must cover every frozen POS bill line; missing or extra lines are not allowed."
  );
  check(
    "erp_integration",
    false,
    "Statutory invoice serials, fiscal-year series, signed IRP/QR evidence, and return reconciliation are not enabled."
  );
  check(
    "irp_applicability",
    false,
    input.irpDecision === "undetermined"
      ? "Determine IRP applicability with the taxpayer and official guidance before issuing."
      : "Declared IRP applicability requires verification; no IRP integration is installed."
  );
  check(
    "supplier_authority",
    false,
    "Seller GSTIN format is not proof of registration, supplier signature, or legal approval."
  );
  check(
    "operator_gate",
    false,
    "Existing database statutory issuance guard remains closed; this endpoint never issues documents."
  );

  const intra =
    gstinSyntax.test(sellerGstin) && sellerGstin.slice(0, 2) === input.placeOfSupplyStateCode;
  const rows: GstDraftLine[] = [];
  let totalTax = 0n;
  let totalBase = 0n;
  let totalDue = 0n;
  const count = Math.min(packet.lines.length, input.lines.length);
  for (let i = 0; i < count; i++) {
    const declared = input.lines[i]!;
    const frozen = packet.lines[i]!;
    const base = amount(frozen["baseMinor"]);
    const frozenTax = amount(frozen["taxMinor"]);
    const frozenTotal = amount(frozen["totalMinor"]);
    const quantity = frozen["quantity"];
    const validQuantity =
      typeof quantity === "number" &&
      Number.isSafeInteger(quantity) &&
      quantity > 0 &&
      quantity <= 10000;
    const needsIntra = declared.componentMode !== "igst";
    const appropriateSplit = intra ? needsIntra : declared.componentMode === "igst";
    check(
      "line_" + i + "_classification",
      declared.classification === "services"
        ? declared.hsnSac.length === 6
        : declared.hsnSac.length >= 4,
      "HSN/SAC length is preliminary only; merchant must verify applicable classification and rate."
    );
    check(
      "line_" + i + "_place_of_supply",
      appropriateSplit,
      "Inter-state supplies require IGST; intra-state supplies require a reviewed CGST/SGST or CGST/UTGST treatment."
    );
    check(
      "line_" + i + "_utgst_jurisdiction",
      declared.componentMode !== "cgst_utgst",
      "CGST/UTGST applicability must be separately verified for the relevant Union Territory before issuance."
    );
    check(
      "line_" + i + "_frozen",
      base !== null &&
        frozenTax !== null &&
        frozenTotal !== null &&
        validQuantity &&
        !!textValue(frozen["name"]),
      "A complete frozen line, quantity and immutable tax snapshot is required."
    );
    if (base === null || frozenTax === null || frozenTotal === null || !validQuantity) continue;
    const r = BigInt(declared.rateBps);
    const c = BigInt(declared.cessBps);
    const central = needsIntra ? roundHalfUp(base * r, 20000n) : 0n;
    const integrated = needsIntra ? 0n : roundHalfUp(base * r, 10000n);
    const sgst = declared.componentMode === "cgst_sgst" ? central : 0n;
    const utgst = declared.componentMode === "cgst_utgst" ? central : 0n;
    const cess = roundHalfUp(base * c, 10000n);
    const computedTax = central + sgst + utgst + integrated + cess;
    const due = base + computedTax;
    const reconciled = computedTax === frozenTax && due === frozenTotal;
    check(
      "line_" + i + "_reconcile",
      reconciled,
      "Draft components must match the *frozen* bill, including inclusive prices and line rounding; no repricing is permitted."
    );
    totalTax += computedTax;
    totalBase += base;
    totalDue += due;
    rows.push({
      description: textValue(frozen["name"]),
      quantity: Number(quantity),
      hsnSac: declared.hsnSac,
      classification: declared.classification,
      unitCode: declared.unitCode,
      taxableBaseMinor: String(base),
      cgstMinor: String(central),
      sgstMinor: String(sgst),
      utgstMinor: String(utgst),
      igstMinor: String(integrated),
      cessMinor: String(cess),
      taxMinor: String(computedTax),
      totalMinor: String(due),
      ledgerTaxMinor: String(frozenTax),
      reconciled,
    });
  }
  const frozenBase = amount(packet.taxableBaseMinor);
  const frozenTax = amount(packet.taxMinor);
  const frozenDue = amount(packet.totalMinor);
  const totalsValid =
    frozenBase !== null &&
    frozenTax !== null &&
    frozenDue !== null &&
    frozenBase + frozenTax === frozenDue &&
    rows.length === packet.lines.length &&
    totalBase === frozenBase &&
    totalTax === frozenTax &&
    totalDue === frozenDue &&
    totalDue <= MAX;
  check(
    "ledger_totals",
    totalsValid,
    "Sum of GST components and taxable values must exactly equal the original frozen bill; no silent tax adjustment."
  );
  check(
    "bill_of_supply",
    input.kind !== "bill_of_supply_draft" || totalTax === 0n,
    "Bill of supply cannot claim positive GST collection; mixed/exempt cases require separate jurisdiction review."
  );
  return {
    mode: "india_gst_preissue_review",
    currency: packet.currency,
    saleId: input.saleId,
    documentType: input.kind,
    issuingAuthorityVerified: false,
    irpVerified: false,
    statutoryIssuanceAllowed: false,
    serialAllocated: false,
    snapshotOnly: true,
    checks,
    issues: checks.filter((item) => !item.satisfied).length,
    lines: rows,
    taxableBaseMinor: String(totalBase),
    taxMinor: String(totalTax),
    totalMinor: String(totalDue),
    frozenBillTotalMinor: packet.totalMinor,
    notice:
      "DRAFT REVIEW ONLY — NOT A TAX INVOICE OR BILL OF SUPPLY. No serial, IRN, signed QR, tax credit note or government submission is created.",
  };
}
