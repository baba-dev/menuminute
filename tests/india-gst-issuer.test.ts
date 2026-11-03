import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  formatIndianGstSerial,
  indianFiscalYear,
  indiaIrpGateway,
  IrpNotConfiguredError,
  verifyIrpPartnerJws,
} from "../src/modules/pos/india-gst-issuer";

const expected = {
  sellerGstin: "08ABCDE1234F1Z5",
  documentNumber: "INV/26/000001",
  fiscalYearStart: 2026,
  documentTotalMinor: "11800",
};
const claims = {
  ...expected,
  irn: "f".repeat(64),
  acknowledgementIso: "2026-11-03T09:10:11+05:30",
};

function signedToken(payload: object = claims, keyId = "trusted-1", privateKey?: string) {
  const keys = privateKey
    ? { privateKey }
    : generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: keyId })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign("RSA-SHA256", Buffer.from(header + "." + body), keys.privateKey).toString(
    "base64url"
  );
  return {
    token: header + "." + body + "." + signature,
    publicKey: "publicKey" in keys ? keys.publicKey : "",
  };
}

describe("India GST statutory series and IRP boundary", () => {
  it("uses April–March fiscal years rather than Gregorian calendar years", () => {
    expect(indianFiscalYear("2026-03-31")).toBe(2025);
    expect(indianFiscalYear("2026-04-01")).toBe(2026);
    expect(indianFiscalYear("2027-01-01")).toBe(2026);
    for (const date of ["2026-02-30", "2026-13-01", "2026-00-01", "01-04-2026"]) {
      expect(() => indianFiscalYear(date)).toThrow();
    }
  });

  it("formats valid <=16-char fiscal serials and rejects all overflow", () => {
    expect(formatIndianGstSerial("INV", 2026, 1)).toBe("INV/26/000001");
    expect(formatIndianGstSerial("SERIES", 2026, 999999)).toBe("SERIES/26/999999");
    for (const [prefix, fy, serial] of [
      ["LOWER", 2016, 1],
      ["SEVEN77", 2026, 1],
      ["C", 2026, 0],
      ["C", 2026, 1_000_000],
      ["credit-note", 2026, 1],
    ] as const) {
      expect(() => formatIndianGstSerial(prefix, fy, serial)).toThrow();
    }
  });

  it("refuses every outbound action without IRP credentials or authorization", async () => {
    await expect(indiaIrpGateway.submit()).rejects.toBeInstanceOf(IrpNotConfiguredError);
    await expect(indiaIrpGateway.reconcile()).rejects.toBeInstanceOf(IrpNotConfiguredError);
    await expect(indiaIrpGateway.cancel()).rejects.toBeInstanceOf(IrpNotConfiguredError);
  });

  it("verifies a pinned-key signed response and reconciles its GSTIN, serial and total", () => {
    const { token, publicKey } = signedToken();
    const result = verifyIrpPartnerJws(token, expected, { "trusted-1": publicKey });
    expect(result).toMatchObject({
      sellerGstin: expected.sellerGstin,
      documentNumber: expected.documentNumber,
      irn: "f".repeat(64),
      verifiedSignature: true,
      irpReconciliationOnly: true,
    });
    expect(result.responseSha256).toBe(createHash("sha256").update(token).digest("hex"));
    expect(result.acknowledgementIso).toBe("2026-11-03T03:40:11.000Z");
    expect("statutoryIssuanceAllowed" in result).toBe(false);
  });

  it("rejects unknown key IDs, altered payload, wrong ledger total and incorrect authority", () => {
    const real = signedToken();
    const attacker = signedToken();
    expect(() => verifyIrpPartnerJws(real.token, expected, { another: real.publicKey })).toThrow();
    expect(() =>
      verifyIrpPartnerJws(attacker.token, expected, { "trusted-1": real.publicKey })
    ).toThrow();
    expect(() =>
      verifyIrpPartnerJws(
        real.token,
        { ...expected, documentTotalMinor: "999" },
        { "trusted-1": real.publicKey }
      )
    ).toThrow();
    const parts = real.token.split(".");
    const altered = Buffer.from(JSON.stringify({ ...claims, documentTotalMinor: "1" })).toString(
      "base64url"
    );
    expect(() =>
      verifyIrpPartnerJws(parts[0] + "." + altered + "." + parts[2], expected, {
        "trusted-1": real.publicKey,
      })
    ).toThrow();
  });

  it("rejects non-RS256, malformed/oversize JWS and false IRNs", () => {
    const keys = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const unsupported = signedToken(claims, "trusted-1", keys.privateKey);
    const decoded = unsupported.token.split(".");
    const wrongAlg = Buffer.from(JSON.stringify({ kid: "trusted-1", alg: "none" })).toString(
      "base64url"
    );
    expect(() =>
      verifyIrpPartnerJws(wrongAlg + "." + decoded[1] + "." + decoded[2], expected, {
        "trusted-1": keys.publicKey,
      })
    ).toThrow();
    expect(() => verifyIrpPartnerJws("not-a-jws", expected, {})).toThrow();
    expect(() => verifyIrpPartnerJws("a".repeat(64001), expected, {})).toThrow();
    const fake = signedToken({ ...claims, irn: "NOT-AN-IRN" });
    expect(() =>
      verifyIrpPartnerJws(fake.token, expected, { "trusted-1": fake.publicKey })
    ).toThrow();
  });
});
