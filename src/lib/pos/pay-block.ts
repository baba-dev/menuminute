import QRCode from "qrcode";
import type { ThermalPaper } from "./thermal-receipt";
import { GLYPH_ADVANCE, GLYPH_HEIGHT, glyphFor } from "./pay-block-font";

/** Two-section "Scan & Pay" receipt block: UPI QR on the left, amount and instructions on the right.
 * A printer cannot place text beside an image, so everything is drawn into one 1-bit bitmap that the
 * thermal encoder sends as a raster image. Pure TypeScript: identical in the browser and on the server.
 * Nothing here contacts a payment provider.
 */
export type PayBlockInput = {
  /** Pre-filled `upi://pay?...` link (see `buildUpiPayUri`). */
  uri: string;
  /** Printed amount, for example `Rs 840.00`. */
  amountLabel: string;
  payeeName: string;
  upiId: string;
};

/** 1 = black, rows packed MSB first, `widthBytes * heightDots` bytes. */
export type PayBlockBitmap = {
  widthDots: number;
  heightDots: number;
  widthBytes: number;
  data: Uint8Array;
};

const MAX_QR_VERSION = 5;
const QR_MODULES_V5 = 37;
const QUIET_MODULES = 4;
const BORDER = 2;
const SECTION_PAD = 4;
const TEXT_PAD_X = 8;
const MAX_BAND_ROWS = 128;

type Surface = { width: number; height: number; px: Uint8Array };

function fillRect(s: Surface, x: number, y: number, w: number, h: number, limitX = s.width) {
  for (let yy = Math.max(0, y); yy < Math.min(s.height, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(limitX, x + w); xx++) s.px[yy * s.width + xx] = 1;
}

function textWidth(text: string, scale: number) {
  return text.length === 0 ? 0 : (text.length * GLYPH_ADVANCE - 1) * scale;
}

function drawText(
  s: Surface,
  x: number,
  y: number,
  text: string,
  scale: number,
  limitX: number
): void {
  for (let i = 0; i < text.length; i++) {
    const columns = glyphFor(text[i]!);
    for (let col = 0; col < columns.length; col++)
      for (let row = 0; row < GLYPH_HEIGHT; row++)
        if ((columns[col]! >> row) & 1)
          fillRect(s, x + (i * GLYPH_ADVANCE + col) * scale, y + row * scale, scale, scale, limitX);
  }
}

function clip(text: string, maxChars: number) {
  return text.length <= maxChars ? text : text.slice(0, Math.max(0, maxChars - 3)) + "...";
}

/** Greedy word wrap; continuation lines are indented by `indent` characters. */
function wrap(text: string, maxChars: number, indent = 0): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const limit = lines.length === 0 ? maxChars : maxChars - indent;
    const next = line ? line + " " + word : word;
    if (next.length <= limit) line = next;
    else {
      if (line) lines.push(line);
      line = clip(word, maxChars - (lines.length ? indent : 0));
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : " ".repeat(indent) + l));
}

function largestFittingScale(text: string, scales: number[], available: number) {
  return scales.find((scale) => textWidth(text, scale) <= available) ?? 1;
}

const STEPS = ["1 Open any UPI app", "2 Scan this code", "3 Check name, pay, show staff the tick"];

/** Returns null when the link needs more than QR version 5 or anything goes wrong; callers then
 * print the receipt without the block.
 */
export function renderPayBlock(input: PayBlockInput, paper: ThermalPaper): PayBlockBitmap | null {
  try {
    const qr = QRCode.create(input.uri, { errorCorrectionLevel: "M" });
    if (qr.version > MAX_QR_VERSION) return null;
    const modules = qr.modules.size;
    const wide = paper === "80";
    const width = wide ? 576 : 384;
    const scale = wide ? 5 : 4;
    const leftWidth = (QR_MODULES_V5 + 2 * QUIET_MODULES) * scale + 2 * SECTION_PAD;
    const rightX = BORDER + leftWidth + BORDER;
    const rightWidth = width - rightX - BORDER - 4;
    const available = rightWidth - 2 * TEXT_PAD_X;
    const textLimitX = width - BORDER - 4;

    const headingScale = largestFittingScale("SCAN & PAY", wide ? [3, 2] : [2], available);
    const amountScale = largestFittingScale(input.amountLabel, wide ? [3, 2] : [2], available);
    const stepScale = wide ? 2 : 1;
    const stepChars = Math.floor(available / (GLYPH_ADVANCE * stepScale));
    const smallChars = Math.floor(available / GLYPH_ADVANCE);

    type Row = { kind: "text"; text: string; scale: number } | { kind: "rule" } | { kind: "gap" };
    const rows: Row[] = [
      { kind: "text", text: "SCAN & PAY", scale: headingScale },
      { kind: "gap" },
      { kind: "text", text: input.amountLabel, scale: amountScale },
      { kind: "gap" },
      { kind: "rule" },
      { kind: "gap" },
    ];
    for (const step of STEPS) {
      for (const text of wrap(step, stepChars, 2))
        rows.push({ kind: "text", text, scale: stepScale });
    }
    rows.push({ kind: "gap" }, { kind: "rule" }, { kind: "gap" });
    for (const text of wrap(input.payeeName, smallChars).slice(0, 2))
      rows.push({ kind: "text", text: clip(text, smallChars), scale: 1 });
    rows.push({ kind: "text", text: clip(input.upiId, smallChars), scale: 1 });

    const rowHeight = (row: Row) =>
      row.kind === "text" ? (GLYPH_HEIGHT + 3) * row.scale : row.kind === "rule" ? 2 : 6;
    const rightContent = rows.reduce((sum, row) => sum + rowHeight(row), 0) + 2 * TEXT_PAD_X;
    const inner = Math.max(leftWidth, rightContent);
    const height = inner + 2 * BORDER;

    const s: Surface = { width, height, px: new Uint8Array(width * height) };
    // Frame and divider.
    fillRect(s, 0, 0, width, BORDER);
    fillRect(s, 0, height - BORDER, width, BORDER);
    fillRect(s, 0, 0, BORDER, height);
    fillRect(s, width - BORDER, 0, BORDER, height);
    fillRect(s, BORDER + leftWidth, 0, BORDER, height);

    // Left section: corner brackets sit in the pad ring, outside the QR quiet zone.
    const top = BORDER + Math.floor((inner - leftWidth) / 2);
    const arm = 14;
    const left = BORDER + 2;
    const right = BORDER + leftWidth - 4;
    const bottom = top + leftWidth - 2 - 2;
    for (const [x, y, dx, dy] of [
      [left, top + 2, 1, 1],
      [right, top + 2, -1, 1],
      [left, bottom, 1, -1],
      [right, bottom, -1, -1],
    ] as const) {
      fillRect(s, dx > 0 ? x : x - arm + 2, y, arm, 2);
      fillRect(s, x, dy > 0 ? y : y - arm + 2, 2, arm);
    }
    // QR modules, centred inside the quiet zone.
    const offset = QUIET_MODULES + Math.floor((QR_MODULES_V5 - modules) / 2);
    const qrX = BORDER + SECTION_PAD + offset * scale;
    const qrY = top + SECTION_PAD + offset * scale;
    for (let row = 0; row < modules; row++)
      for (let col = 0; col < modules; col++)
        if (qr.modules.get(row, col))
          fillRect(s, qrX + col * scale, qrY + row * scale, scale, scale);

    // Right section.
    let y = BORDER + Math.floor((inner - rightContent) / 2) + TEXT_PAD_X;
    const x = rightX + TEXT_PAD_X;
    for (const row of rows) {
      if (row.kind === "text") drawText(s, x, y, row.text, row.scale, textLimitX);
      else if (row.kind === "rule") fillRect(s, x, y, available, 2, textLimitX);
      y += rowHeight(row);
    }

    const widthBytes = width / 8;
    const data = new Uint8Array(widthBytes * height);
    for (let yy = 0; yy < height; yy++)
      for (let xx = 0; xx < width; xx++)
        if (s.px[yy * width + xx]) data[yy * widthBytes + (xx >> 3)]! |= 0x80 >> (xx & 7);
    return { widthDots: width, heightDots: height, widthBytes, data };
  } catch {
    return null;
  }
}

/** ESC/POS `GS v 0` raster image, split into bands so small printer buffers are not overrun. */
export function payBlockToEscPos(b: PayBlockBitmap): number[] {
  const out: number[] = [];
  for (let start = 0; start < b.heightDots; start += MAX_BAND_ROWS) {
    const rows = Math.min(MAX_BAND_ROWS, b.heightDots - start);
    out.push(
      0x1d,
      0x76,
      0x30,
      0x00,
      b.widthBytes & 0xff,
      b.widthBytes >> 8,
      rows & 0xff,
      rows >> 8
    );
    const slice = b.data.subarray(start * b.widthBytes, (start + rows) * b.widthBytes);
    for (let i = 0; i < slice.length; i++) out.push(slice[i]!);
  }
  return out;
}

/** Black-on-white RGBA pixels, for an on-screen canvas preview identical to the print. */
export function payBlockToRgba(b: PayBlockBitmap): Uint8ClampedArray {
  const out = new Uint8ClampedArray(b.widthDots * b.heightDots * 4);
  for (let y = 0; y < b.heightDots; y++)
    for (let x = 0; x < b.widthDots; x++) {
      const ink = (b.data[y * b.widthBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
      const i = (y * b.widthDots + x) * 4;
      const value = ink ? 0 : 255;
      out[i] = value;
      out[i + 1] = value;
      out[i + 2] = value;
      out[i + 3] = 255;
    }
  return out;
}
