/** Client-only receipt printing bridge. No cloud server ever contacts a local printer. */
export type ReceiptPaper = "58" | "80";
export type TerminalReceiptSettings = {
  enabled: boolean;
  paper: ReceiptPaper;
};
const defaultSettings: TerminalReceiptSettings = { enabled: false, paper: "80" };
function key(outletId: string) {
  return "menuminute:pos:receipt-terminal:v1:" + outletId;
}
export function readTerminalReceiptSettings(outletId: string): TerminalReceiptSettings {
  if (typeof window === "undefined") return { ...defaultSettings };
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key(outletId)) ?? "null");
    if (stored && typeof stored === "object") {
      const data = stored as Record<string, unknown>;
      return {
        enabled: data.enabled === true,
        paper: data.paper === "58" ? "58" : "80",
      };
    }
  } catch {
    // Storage may be unavailable or corrupt; never interfere with submitting the order.
  }
  return { ...defaultSettings };
}
export function saveTerminalReceiptSettings(outletId: string, settings: TerminalReceiptSettings): void {
  try {
    window.localStorage.setItem(key(outletId), JSON.stringify(settings));
  } catch {
    // Best-effort, terminal-scoped preference only; not a financial record.
  }
}
export function receiptHref(saleId: string, paper: ReceiptPaper, auto: boolean): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(saleId)) throw new Error("Invalid sale reference");
  return "/dashboard/pos/receipts/" + encodeURIComponent(saleId) +
    "?paper=" + paper + (auto ? "&auto=1" : "");
}
/**
 * Reserve the popup during the actual click gesture, before the async submit.
 * Returns null when popup policy blocks it; callers must offer an explicit link.
 */
export function reserveReceiptWindow(): Window | null {
  const child = window.open("about:blank", "_blank");
  if (child) {
    child.document.title = "Preparing MenuMinute receipt";
    child.document.body.textContent = "Preparing your receipt…";
  }
  return child;
}
export function dispatchReceiptToWindow(child: Window | null, href: string): boolean {
  if (!child || child.closed) return false;
  try {
    child.location.replace(href);
    return true;
  } catch {
    return false;
  }
}
export function discardReservedWindow(child: Window | null) {
  try { if (child && !child.closed) child.close(); } catch { /* browser-managed */ }
}
