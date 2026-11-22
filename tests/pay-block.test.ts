import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import {
  payBlockToEscPos,
  payBlockToRgba,
  renderPayBlock,
  type PayBlockBitmap,
  type PayBlockInput,
} from "../src/lib/pos/pay-block";
import { buildUpiPayUri } from "../src/lib/pos/upi";

const uri = buildUpiPayUri({
  vpa: "spiceroute@okhdfc",
  payeeName: "Spice Route",
  amountMinor: "84000",
  billNo: "1042",
})!;
const input: PayBlockInput = {
  uri,
  amountLabel: "Rs 840.00",
  payeeName: "Spice Route Kitchen",
  upiId: "spiceroute@okhdfc",
};

function pixel(b: PayBlockBitmap, x: number, y: number) {
  return (b.data[y * b.widthBytes + (x >> 3)]! >> (7 - (x & 7))) & 1;
}
function inkInColumns(b: PayBlockBitmap, from: number, to: number) {
  let ink = 0;
  // Rows between the 2-dot top and bottom frame lines.
  for (let y = 2; y < b.heightDots - 2; y++) for (let x = from; x < to; x++) ink += pixel(b, x, y);
  return ink;
}
function decode(b: PayBlockBitmap) {
  return jsQR(payBlockToRgba(b), b.widthDots, b.heightDots)?.data ?? null;
}

describe("renderPayBlock", () => {
  for (const [paper, width] of [
    ["80", 576],
    ["58", 384],
  ] as const) {
    it(`fills the ${paper} mm paper width with packed rows`, () => {
      const b = renderPayBlock(input, paper)!;
      expect(b.widthDots).toBe(width);
      expect(b.widthBytes * 8).toBe(width);
      expect(b.data.length).toBe(b.widthBytes * b.heightDots);
    });
    it(`prints a QR that decodes back to the exact link on ${paper} mm`, () => {
      expect(decode(renderPayBlock(input, paper)!)).toBe(uri);
    });
    it(`decodes a longer link (QR version 6, up to 106 bytes) on ${paper} mm`, () => {
      const long = buildUpiPayUri({
        vpa: "spiceroutekitchen.business@okhdfcbank",
        payeeName: "Extraordinarily Long Kitchen Name",
        amountMinor: "99999999",
        billNo: "123456",
      })!;
      expect(long.length).toBeGreaterThan(84);
      expect(long.length).toBeLessThanOrEqual(106);
      const block = renderPayBlock({ ...input, uri: long }, paper)!;
      expect(block).not.toBeNull();
      expect(decode(block)).toBe(long);
    });
    it(`never overflows the right edge with long text on ${paper} mm`, () => {
      const b = renderPayBlock(
        {
          ...input,
          payeeName: "Extraordinarily Long Kitchen Name Co",
          upiId: "a-very-long-restaurant-handle-name.with.dots@okhdfcbank",
          amountLabel: "Rs 9999999999.99",
        },
        paper
      )!;
      // The 2-dot frame is the outermost ink; the 4 columns just inside it stay blank.
      expect(inkInColumns(b, width - 6, width - 2)).toBe(0);
      expect(inkInColumns(b, width - 2, width)).toBeGreaterThan(0);
    });
    it(`has ink in the details section on ${paper} mm`, () => {
      const b = renderPayBlock(input, paper)!;
      expect(inkInColumns(b, Math.floor(width * 0.6), width - 6)).toBeGreaterThan(0);
    });
  }
  it("returns null when the link needs more than QR version 6", () => {
    expect(renderPayBlock({ ...input, uri: "upi://pay?pa=" + "a".repeat(200) }, "80")).toBeNull();
  });
});

describe("payBlockToEscPos", () => {
  it("emits GS v 0 raster bands of at most 128 rows covering every byte", () => {
    const b = renderPayBlock(input, "80")!;
    expect(b.heightDots).toBeGreaterThan(128);
    const bytes = payBlockToEscPos(b);
    expect(bytes.slice(0, 4)).toEqual([0x1d, 0x76, 0x30, 0x00]);
    let offset = 0;
    let rows = 0;
    let bands = 0;
    while (offset < bytes.length) {
      expect(bytes.slice(offset, offset + 4)).toEqual([0x1d, 0x76, 0x30, 0x00]);
      const xBytes = bytes[offset + 4]! + bytes[offset + 5]! * 256;
      const yRows = bytes[offset + 6]! + bytes[offset + 7]! * 256;
      expect(xBytes).toBe(b.widthBytes);
      expect(yRows).toBeLessThanOrEqual(128);
      offset += 8 + xBytes * yRows;
      rows += yRows;
      bands++;
    }
    expect(offset).toBe(bytes.length);
    expect(rows).toBe(b.heightDots);
    expect(bands).toBeGreaterThan(1);
  });
});
