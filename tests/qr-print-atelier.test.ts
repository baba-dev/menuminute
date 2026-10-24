import { describe, expect, it } from "vitest";
import { DEFAULT_PRINT_DESIGN, normalizePrintCopy, printableQr, PRINT_FORMATS } from "../src/components/menu-product/qr-print-contract";
import type { QR } from "../src/components/menu-product/qr-studio-types";

const inventory: QR[] = [
  { id: "revoked", label: "Old card", destinationToken: "expired", isActive: false, tableId: null, pointLabel: null },
  { id: "active", label: "Main", destinationToken: "permanent", isActive: true, tableId: null, pointLabel: null },
  { id: "other", label: "Table 3", destinationToken: "another", isActive: true, tableId: "3", pointLabel: "Table 3" },
];
describe("Print Atelier safety contracts", () => {
  it("never returns a revoked code for print selection", () => {
    expect(printableQr(inventory, "other")?.id).toBe("other");
    expect(printableQr(inventory, "revoked")?.id).toBe("active");
    expect(printableQr(inventory, "not-in-this-outlet")?.id).toBe("active");
    expect(printableQr([inventory[0]], "revoked")).toBeNull();
  });
  it("keeps physical templates distinct and QR sizes bounded within the actual sheet", () => {
    expect(new Set(Object.values(PRINT_FORMATS).map((x) => x.widthMm + "x" + x.heightMm)).size).toBe(3);
    for (const spec of Object.values(PRINT_FORMATS)) {
      expect(spec.qrMm).toBeGreaterThanOrEqual(40);
      expect(spec.qrMm).toBeLessThanOrEqual(Math.min(spec.widthMm - 12, spec.heightMm - 12));
    }
  });
  it("normalizes customer copy without accepting markup rendering or changing token identity", () => {
    expect(normalizePrintCopy("  hello   guests\n today  ", 52)).toBe("hello guests today");
    expect(normalizePrintCopy("x".repeat(80), 52)).toHaveLength(52);
    expect(DEFAULT_PRINT_DESIGN.showUrl).toBe(false);
    expect(DEFAULT_PRINT_DESIGN.palette).toBe("ember");
  });
});
