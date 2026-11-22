/** UPI (NPCI deep-link) helpers. Pure and dependency-free: used by the browser BLE print path, the
 * server print bridge and the settings UI. Nothing here contacts a payment provider; it only builds
 * a text link that a payer's own UPI app opens.
 */

import type { PayBlockInput } from "./pay-block";

/** Maximum link size in bytes (the link is ASCII, so this equals its length): QR version 6 at
 * error-correction level M holds 106 bytes (41 modules). Realistic merchant UPI IDs up to about 50
 * characters still fit; the payee name inside the link is shortened first to make room.
 */
export const UPI_URI_MAX_BYTES = 106;

const UPI_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

/** Returns the trimmed, lower-cased UPI ID (VPA), or null when it is not a plain `name@bank`. */
export function parseUpiId(raw: string): string | null {
  const value = raw.trim();
  return UPI_ID_PATTERN.test(value) ? value.toLowerCase() : null;
}

/** Plain printable payee name (2 to 40 characters of `[A-Za-z0-9 .&'-]`), or null. */
export function normalizePayeeName(raw: string): string | null {
  const clean = raw
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .&'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length >= 2 && clean.length <= 40 ? clean : null;
}

/** `"84000"` becomes `"840.00"` using integer arithmetic only. Null for zero or invalid input. */
export function inrMinorToDecimal(minor: string): string | null {
  if (!/^[0-9]{1,12}$/.test(minor)) return null;
  const value = BigInt(minor);
  if (value <= 0n) return null;
  const whole = value / 100n;
  const cents = (value % 100n).toString().padStart(2, "0");
  return `${whole}.${cents}`;
}

/** True when this UPI ID can always be printed: it fits a link for a realistic worst-case bill
 * (up to Rs 999999.99, a 6-digit bill number and a 2-character payee hint). Use at save time so a
 * merchant is told now, not discovered when bills print without the QR.
 */
export function upiIdFitsQr(raw: string): boolean {
  const vpa = parseUpiId(raw);
  return (
    vpa !== null &&
    buildUpiPayUri({ vpa, payeeName: "Sp", amountMinor: "99999999", billNo: "123456" }) !== null
  );
}

/** Pre-filled UPI payment link, or null when any input is invalid or it cannot fit in
 * {@link UPI_URI_MAX_BYTES}. The payee name is shortened first to make it fit.
 */
export function buildUpiPayUri(input: {
  vpa: string;
  payeeName: string;
  amountMinor: string;
  billNo: string;
}): string | null {
  const vpa = parseUpiId(input.vpa);
  const name = normalizePayeeName(input.payeeName);
  const amount = inrMinorToDecimal(input.amountMinor);
  if (!vpa || !name || !amount || !/^[A-Za-z0-9-]{1,20}$/.test(input.billNo)) return null;
  const note = encodeURIComponent(`Bill ${input.billNo}`);
  for (let length = name.length; length >= 2; length--) {
    const payee = name.slice(0, length).trimEnd();
    if (payee.length < 2) break;
    const uri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payee)}&am=${amount}&cu=INR&tn=${note}`;
    if (uri.length <= UPI_URI_MAX_BYTES) return uri;
  }
  return null;
}

/** Fixed sample bill used by the settings and onboarding previews: Rs 840.00, bill 1042. */
export function samplePayBlock(vpa: string, payeeName: string): PayBlockInput | null {
  const upiId = parseUpiId(vpa);
  const payee = normalizePayeeName(payeeName);
  if (!upiId || !payee) return null;
  const uri = buildUpiPayUri({
    vpa: upiId,
    payeeName: payee,
    amountMinor: "84000",
    billNo: "1042",
  });
  return uri ? { uri, amountLabel: "Rs 840.00", payeeName: payee, upiId } : null;
}
