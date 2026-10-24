import type { QR } from "./qr-studio-types";

export type PrintFormat = "stand" | "sticker" | "insert";
export type PrintPalette = "ember" | "ink" | "botanical";
export type PrintDesign = {
  palette: PrintPalette;
  invitation: string;
  supportingCopy: string;
  showUrl: boolean;
  showBrand: boolean;
};

export const PRINT_FORMATS: Record<PrintFormat, {
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  qrMm: number;
  guidance: string;
}> = {
  stand: {
    name: "Table Stand",
    description: "A warm welcome for every table",
    widthMm: 110,
    heightMm: 145,
    qrMm: 58,
    guidance: "Print at actual size on sturdy stock. Use a compatible stand or separately prepared folding mount.",
  },
  sticker: {
    name: "Window / Counter Sticker",
    description: "Quick scanning at the entrance or counter",
    widthMm: 83,
    heightMm: 83,
    qrMm: 45,
    guidance: "Choose a matte surface. Test contrast against the glass or counter behind it.",
  },
  insert: {
    name: "Menu Insert",
    description: "Elegant stationery for menus and takeaway",
    widthMm: 99,
    heightMm: 117,
    qrMm: 53,
    guidance: "Print at actual size and trim within your printer's supported tolerances.",
  },
};

export const DEFAULT_PRINT_DESIGN: PrintDesign = {
  palette: "ember",
  invitation: "Scan to explore our menu",
  supportingCopy: "Fresh choices, always up to date.",
  showUrl: false,
  showBrand: true,
};

export function normalizePrintCopy(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function printableQr(codes: QR[], selectedId: string | null): QR | null {
  return codes.find((qr) => qr.id === selectedId && qr.isActive) ?? codes.find((qr) => qr.isActive) ?? null;
}
