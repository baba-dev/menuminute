import { z } from "zod";

/**
 * Diagnostic-only jurisdiction contract: it does not allocate a fiscal serial,
 * submit to IRP, sign, deliver, or issue a statutory invoice.
 */
const sourceSchema = z
  .object({
    saleId: z.string(),
    outletId: z.string(),
    country: z.string(),
    currency: z.string(),
    sellerCountry: z.string(),
    sellerRegime: z.string(),
    sellerName: z.string(),
    sellerAddress: z.string(),
    sellerTaxRegistration: z.string(),
    customer: z.record(z.string(), z.unknown()),
    lines: z.array(z.record(z.string(), z.unknown())),
    billFrozen: z.boolean(),
    billCurrency: z.string().nullable(),
    billTaxMode: z.string().nullable(),
    taxableBaseMinor: z.string().regex(/^\d+$/),
    taxMinor: z.string().regex(/^\d+$/),
    totalMinor: z.string().regex(/^\d+$/),
    taxProfileRevision: z.number().nullable(),
    jurisdictionPolicy: z.string(),
    operatorFiscalApproved: z.boolean(),
    operatorDocumentsEnabled: z.boolean(),
    externalAdapterInstalled: z.literal(false),
    irpIntegrationVerified: z.literal(false),
    statutoryIssuanceAllowed: z.literal(false),
  })
  .strict();

export type FiscalCheck = {
  id: string;
  label: string;
  satisfied: boolean;
  explanation: string;
};
export type FiscalReadiness = {
  status: "not_configured" | "awaiting_external_approval";
  supportedDiagnosticCountry: "IN" | null;
  saleId: string;
  currency: string;
  statutoryIssuanceAllowed: false;
  reviewOnly: true;
  checks: FiscalCheck[];
  failedCount: number;
  notice: string;
};
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const HSN_SAC = /^\d{4,8}$/;
const asText = (x: unknown) => (typeof x === "string" ? x.trim() : "");

export function assessFiscalReadiness(raw: unknown): FiscalReadiness {
  const data = sourceSchema.parse(raw);
  const checks: FiscalCheck[] = [];
  const check = (id: string, label: string, satisfied: boolean, explanation: string) => {
    checks.push({ id, label, satisfied, explanation });
  };
  const registered = data.sellerRegime === "requires_review";
  const isIndia = data.country === "IN" && data.sellerCountry === "IN";
  check(
    "country",
    "Jurisdiction identified",
    isIndia,
    "Only India has a preliminary diagnostic contract; other markets require their own reviewed adapter."
  );
  check(
    "registration",
    "Supplier GST registration",
    isIndia && registered && GSTIN.test(data.sellerTaxRegistration),
    "Supplier GSTIN format must be checked with the authority; syntax is not registration verification."
  );
  check(
    "seller",
    "Frozen supplier legal details",
    Boolean(
      data.billFrozen && data.sellerName.trim().length >= 2 && data.sellerAddress.trim().length >= 5
    ),
    "An immutable seller legal name and registered address are required."
  );
  check(
    "bill",
    "Immutable priced bill",
    data.billFrozen &&
      data.billCurrency === data.currency &&
      data.lines.length > 0 &&
      data.taxProfileRevision !== null &&
      BigInt(data.taxableBaseMinor) + BigInt(data.taxMinor) === BigInt(data.totalMinor),
    "The bill must freeze its price, tax revision, outlet currency and seller snapshot."
  );
  check(
    "classification",
    "Line HSN/SAC and tax split",
    data.lines.length > 0 &&
      data.lines.every(
        (line) =>
          HSN_SAC.test(asText(line["classification"])) &&
          asText(line["placeOfSupplyStateCode"]).length === 2 &&
          Array.isArray(line["taxComponents"]) &&
          (line["taxComponents"] as unknown[]).length > 0
      ),
    "Each line requires reviewed HSN/SAC, place-of-supply and CGST/SGST/IGST/cess components; generic rate alone is insufficient."
  );
  check(
    "buyer",
    "Buyer and place-of-supply review",
    Boolean(
      asText(data.customer["placeOfSupplyStateCode"]).match(/^\d{2}$/) &&
      asText(data.customer["supplyType"]).match(/^(b2c|b2b|export)$/)
    ),
    "Buyer legal details, supply type, state code, delivery and GSTIN must be resolved per supply."
  );
  check(
    "operator",
    "Explicit operator approval",
    data.operatorFiscalApproved &&
      data.operatorDocumentsEnabled &&
      data.jurisdictionPolicy === "registered_external_adapter_required_v1",
    "POS operator payment/document gates cannot be enabled by the merchant UI."
  );
  check(
    "external",
    "Reviewed jurisdiction adapter and IRP evidence",
    false,
    "No signed/approved invoice adapter or verified IRP integration is installed; the database trigger rejects invoice issuance."
  );
  check(
    "serial",
    "Jurisdiction-valid invoice serial",
    false,
    "An independently approved consecutive series and financial-year allocation have not been implemented."
  );
  return {
    status: checks.some((c) => !c.satisfied) ? "not_configured" : "awaiting_external_approval",
    supportedDiagnosticCountry: isIndia ? "IN" : null,
    saleId: data.saleId,
    currency: data.currency,
    statutoryIssuanceAllowed: false,
    reviewOnly: true,
    checks,
    failedCount: checks.filter((c) => !c.satisfied).length,
    notice:
      "Pre-issuance diagnostic only. No statutory tax invoice, IRN, QR signature, or credit note has been issued.",
  };
}
