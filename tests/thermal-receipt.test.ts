import { describe, expect, it } from "vitest";
import {
  encodeThermalReceipt,
  safePrinterText,
  thermalColumns,
  type ThermalReceipt,
} from "../src/lib/pos/thermal-receipt";
import { canUseAndroidThermalBle } from "../src/lib/pos/thermal-ble";

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
