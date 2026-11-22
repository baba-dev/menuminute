import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areaInputSchema,
  comboInputSchema,
  slotInputSchema,
  tiffinEnabled,
  TIFFIN_OUTLET_TYPE,
  SLOT_KINDS,
} from "@/modules/tiffin/contracts";

const slot = {
  kind: "lunch",
  startMinute: 720,
  endMinute: 840,
  cutoffMinutesBefore: 120,
  capacity: 40,
};
const thali = {
  name: "Veg Thali",
  priceMinor: 12000,
  items: [
    { label: "Dal", quantity: 1 },
    { label: "Sabzi", quantity: 1 },
    { label: "Roti", quantity: 3 },
    { label: "Rice", quantity: 1 },
  ],
  addons: [{ label: "Extra roti", priceMinor: 1000 }],
};

describe("tiffin constants", () => {
  it("exposes the outlet type and slot kinds", () => {
    expect(TIFFIN_OUTLET_TYPE).toBe("tiffin");
    expect(SLOT_KINDS).toEqual(["lunch", "dinner"]);
  });
});

describe("slotInputSchema", () => {
  it("accepts a valid slot and null capacity", () => {
    expect(slotInputSchema.safeParse(slot).success).toBe(true);
    expect(slotInputSchema.safeParse({ ...slot, capacity: null }).success).toBe(true);
  });
  it("bounds capacity to the integer column range", () => {
    expect(slotInputSchema.safeParse({ ...slot, capacity: 2147483647 }).success).toBe(true);
    expect(slotInputSchema.safeParse({ ...slot, capacity: 2147483648 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, capacity: null }).success).toBe(true);
  });
  it("rejects end <= start, negative capacity and bad bounds", () => {
    expect(slotInputSchema.safeParse({ ...slot, endMinute: 720 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, endMinute: 600 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, capacity: -1 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, capacity: 0 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, kind: "brunch" }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, endMinute: 1441 }).success).toBe(false);
    expect(slotInputSchema.safeParse({ ...slot, cutoffMinutesBefore: 10081 }).success).toBe(false);
  });
});

describe("comboInputSchema", () => {
  it("accepts a Veg Thali and defaults description", () => {
    const r = comboInputSchema.safeParse(thali);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBe("");
  });
  it("rejects invalid combos", () => {
    expect(comboInputSchema.safeParse({ ...thali, priceMinor: -1 }).success).toBe(false);
    expect(comboInputSchema.safeParse({ ...thali, priceMinor: 10.5 }).success).toBe(false);
    expect(comboInputSchema.safeParse({ ...thali, items: [] }).success).toBe(false);
    expect(comboInputSchema.safeParse({ ...thali, name: "x".repeat(81) }).success).toBe(false);
  });
});

describe("areaInputSchema", () => {
  it("rejects blank and accepts trimmed names", () => {
    expect(areaInputSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(areaInputSchema.parse({ name: " Koramangala " }).name).toBe("Koramangala");
  });
});

describe("tiffinEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is off when unset", () => {
    vi.stubEnv("TIFFIN_ENABLED", undefined as unknown as string);
    expect(tiffinEnabled()).toBe(false);
  });
  it("reads the flag at call time", () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    expect(tiffinEnabled()).toBe(true);
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(tiffinEnabled()).toBe(false);
  });
  it("rejects other values", () => {
    vi.stubEnv("TIFFIN_ENABLED", "yes");
    expect(() => tiffinEnabled()).toThrow();
  });
});
