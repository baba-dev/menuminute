import { createHash, verify } from "node:crypto";
import { z } from "zod";

/**
 * Verification-only boundary for a GSTN-authorized IRP partner.
 *
 * No network requests, credentials, IRN generation, or QR generation occur here.
 * Real IRP data formats and partner endpoints must be approved separately.
 * The caller must pin the IRP's genuine public key, NEVER an invoice-supplied key.
 */
const gstin = z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/);
const reference = z.string().regex(/^[A-Z0-9/-]{7,16}$/);
const signedClaims = z.object({
  sellerGstin: gstin,
  documentNumber: reference,
  fiscalYearStart: z.number().int().min(2017).max(2100),
  documentTotalMinor: z.string().regex(/^(0|[1-9][0-9]{0,9})$/),
  irn: z.string().regex(/^[a-fA-F0-9]{64}$/),
  acknowledgementIso: z.iso.datetime({ offset: true }),
}).strict();
const header = z.object({ alg: z.literal("RS256"), kid: z.string().min(1).max(128) }).passthrough();
export type VerifiedIrpEvidence = {
  sellerGstin: string;
  documentNumber: string;
  irn: string;
  acknowledgementIso: string;
  responseSha256: string;
  verifiedKeyId: string;
  verifiedSignature: true;
  /** Private verification result, never an issue authorization or GST registration proof. */
  irpReconciliationOnly: true;
};
export type IndiaGstLedgerReadiness = {
  jurisdiction: "IN";
  policyRevision: number;
  registeredOperatorRelease: boolean;
  legalSignoff: boolean;
  financeSignoff: boolean;
  jurisdictionVerified: boolean;
  irpApplicabilityVerified: boolean;
  adapterVerified: boolean;
  signatureVerified: boolean;
  printerAccepted: boolean;
  statutoryIssuanceAvailable: false;
  invoiceCount: number;
  reviewOnly: true;
};

export type IrpExpectedInvoice = {
  sellerGstin: string;
  documentNumber: string;
  fiscalYearStart: number;
  documentTotalMinor: string;
};

/** Converts only well-formed compact JOSE tokens to bytes; disallows padding/whitespace. */
function segment(data: string) {
  if (!data || !/^[A-Za-z0-9_-]+$/.test(data)) throw new Error("Malformed IRP signature encoding");
  const bytes = Buffer.from(data, "base64url");
  if (bytes.toString("base64url") !== data) throw new Error("Non-canonical IRP signature encoding");
  return bytes;
}

/**
 * Accept a separately verified provider normalization for which the supplier's
 * authorized integration has supplied a pinned key. The current app does not
 * provide or fetch trusted public keys, so it cannot execute this on live IRP
 * responses until the partner onboarding and key-rotation procedure is reviewed.
 */
export function verifyIrpPartnerJws(
  compactJws: string,
  expected: IrpExpectedInvoice,
  trustedPublicKeysPem: Readonly<Record<string, string>>
): VerifiedIrpEvidence {
  if (compactJws.length > 64_000) throw new Error("IRP response exceeds bound");
  const parts = compactJws.split(".");
  if (parts.length !== 3) throw new Error("IRP signature must have exactly three segments");
  const [encodedHeader, encodedClaims, encodedSignature] = parts as [string,string,string];
  const metadata = header.parse(JSON.parse(segment(encodedHeader).toString("utf8")));
  const pem = Object.hasOwn(trustedPublicKeysPem, metadata.kid)
    ? trustedPublicKeysPem[metadata.kid] : null;
  if (!pem) throw new Error("IRP signer key is not trusted");
  if (!verify("RSA-SHA256", Buffer.from(encodedHeader+"."+encodedClaims,"ascii"), pem,
    segment(encodedSignature))) throw new Error("IRP signature was not verified");
  const claims = signedClaims.parse(JSON.parse(segment(encodedClaims).toString("utf8")));
  if (claims.sellerGstin !== expected.sellerGstin
    || claims.documentNumber !== expected.documentNumber
    || claims.fiscalYearStart !== expected.fiscalYearStart
    || claims.documentTotalMinor !== expected.documentTotalMinor
  ) throw new Error("IRP signed invoice does not match the frozen document");
  const ack = new Date(claims.acknowledgementIso);
  if (!Number.isFinite(ack.getTime())) throw new Error("Invalid IRP acknowledgement time");
  return {
    sellerGstin: claims.sellerGstin,
    documentNumber: claims.documentNumber,
    irn: claims.irn.toLowerCase(),
    acknowledgementIso: ack.toISOString(),
    responseSha256: createHash("sha256").update(compactJws,"utf8").digest("hex"),
    verifiedKeyId: metadata.kid,
    verifiedSignature: true,
    irpReconciliationOnly: true,
  };
}

export class IrpNotConfiguredError extends Error {
  constructor() {
    super("India GST IRP gateway is not authorized or configured. No fiscal submission was made.");
    this.name = "IrpNotConfiguredError";
  }
}

/** The only public gateway in this release; absence of credentials never falls open. */
export const indiaIrpGateway = {
  async submit(): Promise<never> {
    throw new IrpNotConfiguredError();
  },
  async reconcile(): Promise<never> {
    throw new IrpNotConfiguredError();
  },
  async cancel(): Promise<never> {
    throw new IrpNotConfiguredError();
  },
};

/**
 * A statutory series is derived from the registered GSTIN and Indian FY,
 * never the outlet or a global Gregorian calendar year.
 */
export function indianFiscalYear(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid Indian date");
  const [year, month, day] = date.split("-").map(Number) as [number,number,number];
  const d = new Date(Date.UTC(year,month-1,day));
  if (d.toISOString().slice(0,10)!==date || year<2017 || year>2100)
    throw new Error("Invalid Indian date");
  return month>=4 ? year : year-1;
}

export function formatIndianGstSerial(prefix: string, fiscalYearStart: number, sequence: number) {
  if (!/^[A-Z0-9]{1,6}$/.test(prefix)
    || !Number.isInteger(fiscalYearStart) || fiscalYearStart<2017 || fiscalYearStart>2100
    || !Number.isInteger(sequence) || sequence<1 || sequence>999999)
    throw new Error("Invalid Indian GST series values");
  const result = prefix+"/"+String(fiscalYearStart).slice(-2)+"/"+String(sequence).padStart(6,"0");
  if (result.length>16) throw new Error("GST statutory serial exceeds Rule 46 bound");
  return result;
}
