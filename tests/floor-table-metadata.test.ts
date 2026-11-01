import { describe, expect, it } from "vitest";
import { needsTableMetadataUpdate } from "@/modules/hospitality/floor-table-metadata";

describe("Dining Floor metadata write guard", () => {
  const current = { tableNumber: "A1", label: "Window", capacity: 4 };
  it("does not update physical rows for geometry-only edits", () => {
    expect(needsTableMetadataUpdate(current, { ...current })).toBe(false);
  });
  it("retains table number, label and capacity mutations", () => {
    expect(needsTableMetadataUpdate(current, { ...current, tableNumber: "A2" })).toBe(true);
    expect(needsTableMetadataUpdate(current, { ...current, label: "Garden" })).toBe(true);
    expect(needsTableMetadataUpdate(current, { ...current, capacity: 6 })).toBe(true);
  });
  it("recognizes null metadata rather than masking an intentional edit", () => {
    expect(needsTableMetadataUpdate({ ...current, label: null, capacity: null }, current)).toBe(true);
  });
});
