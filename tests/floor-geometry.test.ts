import { describe, expect, it } from "vitest";
import { layoutTable } from "../src/components/dashboard/floor/table-geometry";

describe("layoutTable", () => {
  it("places exactly one slot per chair for every shape and count", () => {
    for (const shape of ["round", "square", "rectangle", "booth"] as const)
      for (let n = 0; n <= 30; n++) {
        const g = layoutTable(shape, n);
        expect(g.slots, `${shape} ${n}`).toHaveLength(n);
        expect(g.width).toBeGreaterThan(0);
        expect(g.height).toBeGreaterThan(0);
        for (const s of g.slots) {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.x).toBeLessThanOrEqual(g.width);
          expect(s.y).toBeLessThanOrEqual(g.height);
        }
      }
  });
  it("never overlaps two chairs on the same table", () => {
    for (const shape of ["round", "square", "rectangle", "booth"] as const) {
      const { slots } = layoutTable(shape, 12);
      for (let i = 0; i < slots.length; i++)
        for (let j = i + 1; j < slots.length; j++)
          expect(Math.hypot(slots[i]!.x - slots[j]!.x, slots[i]!.y - slots[j]!.y)).toBeGreaterThan(
            30
          );
    }
  });
  it("seats a rectangle on its long sides and a booth on one bench", () => {
    const rect = layoutTable("rectangle", 4);
    expect(rect.slots.filter((s) => s.rotation === 0)).toHaveLength(2);
    expect(rect.slots.filter((s) => s.rotation === 180)).toHaveLength(2);
    const booth = layoutTable("booth", 4);
    expect(booth.slots.every((s) => s.rotation === 0)).toBe(true);
    expect(booth.bench).not.toBeNull();
  });
  it("clamps nonsense counts", () => {
    expect(layoutTable("round", -3).slots).toHaveLength(0);
    expect(layoutTable("round", 99).slots).toHaveLength(30);
  });
});
