import { describe, expect, it } from "vitest";
import {
  filterQrCodes,
  qrDestination,
  qrStatistics,
} from "../src/components/menu-product/qr-studio-types";
import type { QR } from "../src/components/menu-product/qr-studio-types";

const codes: QR[] = [
  {
    id: "one",
    label: "Main Menu",
    destinationToken: "secure-token",
    isActive: true,
    tableId: null,
    pointLabel: null,
  },
  {
    id: "two",
    label: "Table Four",
    destinationToken: "table-token",
    isActive: true,
    tableId: "point-4",
    pointLabel: "Table 4",
  },
  {
    id: "three",
    label: "Old Window",
    destinationToken: "old-token",
    isActive: false,
    tableId: "point-1",
    pointLabel: "Old Window",
  },
];

describe("QR Studio inventory semantics", () => {
  it("counts active service points without presenting scans or retired points as live", () => {
    expect(qrStatistics(codes)).toEqual({ active: 2, servicePoints: 1, revoked: 1, total: 3 });
  });
  it("keeps status and search filtering outlet-inventory-local and non-mutating", () => {
    expect(filterQrCodes(codes, "table", "active").map((q) => q.id)).toEqual(["two"]);
    expect(filterQrCodes(codes, "Table 4", "active").map((q) => q.id)).toEqual(["two"]);
    expect(filterQrCodes(codes, "", "revoked").map((q) => q.id)).toEqual(["three"]);
    expect(filterQrCodes(codes, "OLD", "all").map((q) => q.id)).toEqual(["three"]);
    expect(codes).toHaveLength(3);
  });
  it("builds canonical encoded destinations under configured origin", () => {
    expect(qrDestination("https://food.bababuilds.com", "abc")).toBe(
      "https://food.bababuilds.com/m/abc"
    );
    expect(qrDestination("https://food.bababuilds.com", "a/b")).toBe(
      "https://food.bababuilds.com/m/a%2Fb"
    );
  });
});
