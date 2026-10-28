import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QR_INK_PRESETS, qrInkContrast, safeQrInk, validatedQrInk } from "../src/modules/qr/ink";
import { PRINT_THEMES } from "../src/components/menu-product/qr-print-themes";
import { PRINT_FONTS } from "../src/components/menu-product/qr-print-fonts";
import { DEFAULT_PRINT_DESIGN } from "../src/components/menu-product/qr-print-contract";
import { QrPrintSheet } from "../src/components/menu-product/qr-print-sheet";
import type { QR } from "../src/components/menu-product/qr-studio-types";

const active: QR = {
  id: "live-code",
  label: "Baba Bakery counter",
  isActive: true,
  destinationToken: "stable-destination",
  tableId: null,
  pointLabel: null,
};

describe("QR Studio 4.0 production contracts", () => {
  it("keeps legacy uncoloured downloads black without rotating destinations", () => {
    expect(validatedQrInk(null)).toBe("#000000");
    expect(DEFAULT_PRINT_DESIGN.ink).toBe("#111111");
  });
  it("enforces a 7:1 contrast ratio and rejects invalid or unsafe ink", () => {
    for (const ink of QR_INK_PRESETS) {
      expect(safeQrInk(ink.hex), ink.name).toBe(true);
      expect(qrInkContrast(ink.hex)).toBeGreaterThanOrEqual(7);
      expect(validatedQrInk(ink.hex)).toBe(ink.hex);
    }
    expect(qrInkContrast("#FFFFFF")).toBe(1);
    expect(safeQrInk("#AAAAAA")).toBe(false);
    expect(safeQrInk("#11223344")).toBe(false);
    expect(() => validatedQrInk("#F0F0F0")).toThrow();
    expect(() => validatedQrInk("url(javascript:evil)")).toThrow();
    expect(() => validatedQrInk("#123")).toThrow();
  });
  it("provides nine distinct print themes and five actual font families", () => {
    expect(PRINT_THEMES).toHaveLength(9);
    expect(new Set(PRINT_THEMES.map((theme) => theme.id)).size).toBe(9);
    expect(new Set(PRINT_THEMES.map((theme) => theme.paper)).size).toBe(9);
    expect(PRINT_FONTS).toHaveLength(5);
    expect(new Set(PRINT_FONTS.map((font) => font.id)).size).toBe(5);
  });
  it("always prints MenuMinute signature outside the matrix for every format and theme", () => {
    for (const format of ["stand", "sticker", "insert"] as const) {
      for (const theme of PRINT_THEMES) {
        const html = renderToStaticMarkup(
          <QrPrintSheet
            qr={active}
            format={format}
            restaurant="Baba Bakery"
            origin="http://localhost:3000"
            design={{
              ...DEFAULT_PRINT_DESIGN,
              palette: theme.id,
              font: "playfair",
              ink: "#152A42",
            }}
            active={false}
            onMatrixReady={() => {}}
            onMatrixError={() => {}}
          />
        );
        expect(html).toContain("MenuMinute");
        expect(html).toContain("by BabaBuilds");
        expect(html).toContain("data-real-qr-matrix");
        expect(html).toContain("ink=%23152A42");
        expect(html).toContain('data-font="playfair"');
        expect(html).toContain('data-palette="' + theme.id + '"');
        expect(html.indexOf("data-real-qr-matrix")).toBeLessThan(html.indexOf("MenuMinute"));
        expect(html).toContain("live-code");
      }
    }
  });
  it("does not print a revoked destination", () => {
    expect(
      renderToStaticMarkup(
        <QrPrintSheet
          qr={{ ...active, isActive: false }}
          format="stand"
          restaurant="Baba Bakery"
          origin="http://localhost:3000"
          design={DEFAULT_PRINT_DESIGN}
          active={false}
          onMatrixReady={() => {}}
          onMatrixError={() => {}}
        />
      )
    ).toBe("");
  });
});
