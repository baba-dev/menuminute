import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  encodeThermalReceipt,
  safePrinterText,
  thermalColumns,
  type ThermalReceipt,
} from "../src/lib/pos/thermal-receipt";
import { canUseAndroidThermalBle } from "../src/lib/pos/thermal-ble";
import { buildUpiPayUri } from "../src/lib/pos/upi";

const receipt: ThermalReceipt = {
  merchantName: "BabaBuilds Cafe",
  outletName: "Pilot Kitchen",
  address: "Main Street",
  orderNumber: "01001",
  issuedAt: "8 Nov 2026, 10:30 AM",
  service: "Dine-in",
  customerName: "Example Guest",
  customerPhone: "9876543210",
  table: "4",
  paymentStatus: "COMPLETE",
  items: [{ name: "Citrus Salad", quantity: 2, unitPrice: "Rs 120", lineTotal: "Rs 240" }],
  subtotalLabel: "Subtotal",
  subtotal: "Rs 240",
  taxLabel: "Tax",
  taxAmount: "Rs 12",
  totalLabel: "Total",
  total: "Rs 252",
  closingStatus: "STAFF-RECORDED PAYMENT",
  taxDisclaimer: "NOT A TAX INVOICE",
};

describe("local Android BLE thermal receipt", () => {
  it("only appears for installed Android clients that expose Web Bluetooth", () => {
    expect(canUseAndroidThermalBle(true, true, true)).toBe(true);
    expect(canUseAndroidThermalBle(true, false, true)).toBe(false);
    expect(canUseAndroidThermalBle(false, true, true)).toBe(false);
    expect(canUseAndroidThermalBle(true, true, false)).toBe(false);
  });

  it("sanitizes attacker-controlled ESC/POS bytes from customer and merchant names", () => {
    expect(safePrinterText("Cafe" + String.fromCharCode(0x1b, 0x1d, 0x00) + " Evan")).not.toMatch(
      /[\x00-\x1f]/
    );
    const bytes = encodeThermalReceipt(
      {
        ...receipt,
        merchantName: "EVIL" + String.fromCharCode(0x1d) + "V" + String.fromCharCode(0),
      },
      "58"
    );
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(Array.from(bytes).some((byte, i, list) => byte === 0x1d && list[i + 1] === 0x56)).toBe(
      false
    );
  });

  it.each(["58", "80"] as const)("keeps each receipt line inside %s mm width", (paper) => {
    const bytes = encodeThermalReceipt(receipt, paper);
    const printable: number[] = [];
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0x1b) {
        i += bytes[i + 1] === 0x40 ? 1 : 2;
        continue;
      }
      printable.push(bytes[i]!);
    }
    const lines = new TextDecoder().decode(new Uint8Array(printable)).split("\n");
    expect(Math.max(...lines.map((line) => line.length))).toBeLessThanOrEqual(
      thermalColumns(paper)
    );
    expect(lines.join("\n")).toContain("9876543210");
    expect(lines.join("\n")).toContain("Citrus Salad");
    expect(lines.join("\n")).toContain("NOT A TAX INVOICE");
    expect(lines.join("\n")).toContain("Rs 252");
  });

  it("handles very long dish labels without truncating the amount or changing the sale", () => {
    const bytes = encodeThermalReceipt(
      { ...receipt, items: [{ ...receipt.items[0]!, name: "Verylongdishname".repeat(10) }] },
      "58"
    );
    expect(new TextDecoder().decode(bytes)).toContain("Rs 240");
    expect(bytes.length).toBeLessThan(8000);
  });
});

describe("Scan & Pay block in the thermal receipt", () => {
  // SHA-256 of the encoder output before the pay block existed (same fixture, no payBlock).
  const BASELINE = {
    "58": "d3d86ed77110b439d1c44f56369676736f088ad6116e6c7856d7a5388ffeee8e",
    "80": "0d214996a23c072f38c555fc1ec7e1073c63e41a9360167563506aff78ddce07",
  } as const;
  const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const uri = buildUpiPayUri({
    vpa: "spiceroute@okhdfc",
    payeeName: "Spice Route",
    amountMinor: "25200",
    billNo: "1001",
  })!;
  const payBlock = {
    uri,
    amountLabel: "Rs 252.00",
    payeeName: "Spice Route Kitchen",
    upiId: "spiceroute@okhdfc",
  };
  const find = (bytes: Uint8Array, pattern: number[], from = 0) => {
    for (let i = from; i <= bytes.length - pattern.length; i++)
      if (pattern.every((value, k) => bytes[i + k] === value)) return i;
    return -1;
  };

  it.each(["58", "80"] as const)(
    "leaves %s mm output byte-identical without a pay block",
    (paper) => {
      expect(sha(encodeThermalReceipt(receipt, paper))).toBe(BASELINE[paper]);
      expect(sha(encodeThermalReceipt({ ...receipt, payBlock: null }, paper))).toBe(
        BASELINE[paper]
      );
    }
  );

  it.each(["58", "80"] as const)(
    "prints the raster after the total and before the closing status on %s mm",
    (paper) => {
      const plain = encodeThermalReceipt(receipt, paper);
      const bytes = encodeThermalReceipt({ ...receipt, payBlock }, paper);
      expect(bytes.length).toBeGreaterThan(plain.length);
      const raster = find(bytes, [0x1d, 0x76, 0x30, 0x00]);
      const total = find(bytes, Array.from(new TextEncoder().encode("Rs 252")));
      const closing = find(
        bytes,
        Array.from(new TextEncoder().encode("STAFF-RECORDED PAYMENT")),
        Math.max(raster, 0)
      );
      expect(total).toBeGreaterThan(-1);
      expect(raster).toBeGreaterThan(total);
      expect(closing).toBeGreaterThan(raster);
    }
  );

  it("prints the normal receipt when the link is too long to render", () => {
    const tooLong = { ...payBlock, uri: "upi://pay?pa=" + "a".repeat(200) };
    expect(sha(encodeThermalReceipt({ ...receipt, payBlock: tooLong }, "80"))).toBe(BASELINE["80"]);
  });
});
