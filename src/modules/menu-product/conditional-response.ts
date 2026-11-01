import { createHash } from "node:crypto";
import type { PublicProduct } from "./service";

/** Weak ETag: only the server clock's seconds may differ between responses.
 * Force revalidation on each outlet-local minute so schedule projections stay fresh.
 * The request still passes rate limiting and the PostgreSQL revocation gate.
 */
export function publicMenuEtag(data: PublicProduct): string {
  const minute = Math.floor(Date.parse(data.now) / 60_000);
  // JSON.stringify omits undefined values; no clock-second churn in this hash.
  const stable = { ...data, now: undefined };
  const hash = createHash("sha256")
    .update(JSON.stringify([minute, stable]))
    .digest("hex");
  return `W/"${hash}"`;
}

export function etagMatches(ifNoneMatch: string | null, currentEtag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((entry) => {
    const candidate = entry.trim();
    return candidate === "*" || candidate === currentEtag;
  });
}
