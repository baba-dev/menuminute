import { ValidationError } from "@/lib/errors";

/** A coloured QR is always printed on solid white, with the original four-module quiet zone. */
export const QR_MIN_CONTRAST = 7;
export const QR_INK_PRESETS = [
  { name: "Classic Black", hex: "#111111" },
  { name: "Midnight Navy", hex: "#152A42" },
  { name: "Forest Green", hex: "#17452E" },
  { name: "Royal Indigo", hex: "#29265C" },
  { name: "Ruby", hex: "#54182A" },
  { name: "Deep Teal", hex: "#16474D" },
  { name: "Dark Cocoa", hex: "#4A281A" },
] as const;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function qrInkContrast(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0;
  const red = channel(parseInt(hex.slice(1, 3), 16));
  const green = channel(parseInt(hex.slice(3, 5), 16));
  const blue = channel(parseInt(hex.slice(5, 7), 16));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return 1.05 / (luminance + 0.05);
}

export function safeQrInk(hex: string): boolean {
  return qrInkContrast(hex) >= QR_MIN_CONTRAST;
}

/** Null is the legacy/raw-download behaviour. Only a 6-digit dark ink is accepted. */
export function validatedQrInk(input: string | null): string {
  if (input === null) return "#000000";
  if (!safeQrInk(input)) {
    throw new ValidationError("Choose a darker QR ink colour with at least 7:1 contrast on white.");
  }
  return input.toUpperCase();
}
