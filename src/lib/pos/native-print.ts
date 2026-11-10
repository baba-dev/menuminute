import type { ThermalPaper } from "./thermal-receipt";

/**
 * Hand-off from the web app to the Android print bridge (Bluetooth Classic / USB). The browser cannot
 * open those transports, so the signed-in session mints a short-lived grant for ONE receipt and
 * launches the MenuMinute app with a package-restricted intent:// URL. The native activity redeems the
 * grant for ESC/POS bytes. See src/modules/pos/native-print.ts for the server contract.
 */
export const ANDROID_PACKAGE = "com.bababuilds.menuminute";

export function buildNativePrintIntentUrl(grant: string, fallbackUrl: string): string {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(grant)) throw new Error("Invalid print grant.");
  return (
    `intent://receipt?grant=${grant}#Intent;scheme=menuminute-print;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
  );
}

/** Prepared asynchronously; the browser must launch the intent on a subsequent direct tap. */
export interface PreparedNativePrint {
  intentUrl: string;
  expiresAtMs: number;
}

/** Never navigate to intent:// after awaiting fetch: Chrome may have lost user activation. */
export async function prepareNativePrint(
  saleId: string,
  paper: ThermalPaper,
  fallbackUrl: string
): Promise<PreparedNativePrint> {
  const response = await fetch(
    `/api/pos/receipts/${encodeURIComponent(saleId)}/native-print-grant`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paper }),
      credentials: "same-origin",
      cache: "no-store",
    }
  );
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(problem?.message ?? "Could not start printing. Use Print / save PDF.");
  }
  const body = (await response.json()) as { grant?: unknown; expiresAt?: unknown };
  const expiresAtMs = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
  if (
    typeof body.grant !== "string" ||
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= Date.now()
  ) {
    throw new Error("Could not prepare a valid print request. Please try again.");
  }
  return {
    intentUrl: buildNativePrintIntentUrl(body.grant, fallbackUrl),
    expiresAtMs,
  };
}

/** Recheck expiry immediately before following the prepared link. */
export function nativePrintIsExpired(prepared: PreparedNativePrint, nowMs = Date.now()): boolean {
  return prepared.expiresAtMs <= nowMs + 1000;
}
