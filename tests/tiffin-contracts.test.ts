import { afterEach, describe, expect, it, vi } from "vitest";
import {
  areaInputSchema,
  comboInputSchema,
  comboSaveSchema,
  overrideSetSchema,
  slotInputSchema,
  tiffinEnabled,
  tiffinFlagEnabled,
  tiffinQuoteInputSchema,
  weekSetSchema,
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

describe("phase 1 boundaries", () => {
  it("bounds combo name, items, add-ons, quantity and price", () => {
    const ok = (v: unknown) => comboInputSchema.safeParse(v).success;
    const item = { label: "Dal", quantity: 1 };
    const addon = { label: "Raita", priceMinor: 0 };
    expect(ok({ ...thali, name: "x".repeat(80) })).toBe(true);
    expect(ok({ ...thali, name: "x".repeat(81) })).toBe(false);
    expect(ok({ ...thali, name: "   " })).toBe(false);
    expect(ok({ ...thali, items: Array.from({ length: 20 }, () => item) })).toBe(true);
    expect(ok({ ...thali, items: Array.from({ length: 21 }, () => item) })).toBe(false);
    expect(ok({ ...thali, addons: Array.from({ length: 20 }, () => addon) })).toBe(true);
    expect(ok({ ...thali, addons: Array.from({ length: 21 }, () => addon) })).toBe(false);
    expect(ok({ ...thali, items: [{ label: "Dal", quantity: 0 }] })).toBe(false);
    expect(ok({ ...thali, items: [{ label: "Dal", quantity: 99 }] })).toBe(true);
    expect(ok({ ...thali, items: [{ label: "Dal", quantity: 100 }] })).toBe(false);
    expect(ok({ ...thali, priceMinor: 2147483647 })).toBe(true);
    expect(ok({ ...thali, priceMinor: 2147483648 })).toBe(false);
  });
  it("rejects startMinute 1440", () => {
    expect(slotInputSchema.safeParse({ ...slot, startMinute: 1440 }).success).toBe(false);
  });
});

describe("comboSaveSchema", () => {
  it("allows an optional id and rejects unknown keys", () => {
    expect(comboSaveSchema.safeParse(thali).success).toBe(true);
    expect(comboSaveSchema.safeParse({ ...thali, id: "c1" }).success).toBe(true);
    expect(comboSaveSchema.safeParse({ ...thali, extra: 1 }).success).toBe(false);
  });
});

describe("weekSetSchema", () => {
  const base = { slotKind: "lunch", weekday: 0, comboIds: ["a", "b"] };
  it("validates weekday, unique ids and unknown keys", () => {
    expect(weekSetSchema.safeParse(base).success).toBe(true);
    expect(weekSetSchema.safeParse({ ...base, weekday: 6 }).success).toBe(true);
    expect(weekSetSchema.safeParse({ ...base, weekday: 7 }).success).toBe(false);
    expect(weekSetSchema.safeParse({ ...base, comboIds: ["a", "a"] }).success).toBe(false);
    expect(
      weekSetSchema.safeParse({ ...base, comboIds: Array.from({ length: 51 }, (_, i) => `c${i}`) })
        .success
    ).toBe(false);
    expect(weekSetSchema.safeParse({ ...base, extra: true }).success).toBe(false);
  });
});

describe("overrideSetSchema", () => {
  const base = { slotKind: "dinner", localDate: "2026-02-27", closed: false, comboIds: ["a"] };
  it("validates dates, unique ids and unknown keys", () => {
    expect(overrideSetSchema.safeParse(base).success).toBe(true);
    expect(overrideSetSchema.safeParse({ ...base, localDate: "2026-02-30" }).success).toBe(false);
    expect(overrideSetSchema.safeParse({ ...base, localDate: "26-2-27" }).success).toBe(false);
    expect(overrideSetSchema.safeParse({ ...base, comboIds: ["a", "a"] }).success).toBe(false);
    expect(overrideSetSchema.safeParse({ ...base, extra: true }).success).toBe(false);
  });
});

describe("tiffinQuoteInputSchema", () => {
  const line = { comboId: "a", addonIds: ["x"], quantity: 2 };
  const base = { localDate: "2026-02-27", slotKind: "lunch", lines: [line] };
  it("validates lines and bounds", () => {
    expect(tiffinQuoteInputSchema.safeParse(base).success).toBe(true);
    expect(tiffinQuoteInputSchema.safeParse({ ...base, localDate: "2026-02-30" }).success).toBe(
      false
    );
    expect(tiffinQuoteInputSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(
      tiffinQuoteInputSchema.safeParse({ ...base, lines: Array.from({ length: 101 }, () => line) })
        .success
    ).toBe(false);
    expect(
      tiffinQuoteInputSchema.safeParse({
        ...base,
        lines: [{ ...line, addonIds: Array.from({ length: 21 }, (_, i) => `x${i}`) }],
      }).success
    ).toBe(false);
    expect(
      tiffinQuoteInputSchema.safeParse({ ...base, lines: [{ ...line, quantity: 0 }] }).success
    ).toBe(false);
    expect(tiffinQuoteInputSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });
});

describe("tiffinQuoteInputSchema line quantity", () => {
  const withQty = (quantity: number) => ({
    localDate: "2026-02-27",
    slotKind: "lunch",
    lines: [{ comboId: "a", addonIds: [], quantity }],
  });
  it("accepts any positive safe integer (no merchant-facing cap)", () => {
    expect(tiffinQuoteInputSchema.safeParse(withQty(1000000)).success).toBe(true);
    expect(tiffinQuoteInputSchema.safeParse(withQty(Number.MAX_SAFE_INTEGER)).success).toBe(true);
  });
  it("rejects zero, negative, fractional and unsafe quantities", () => {
    for (const q of [0, -1, 1.5, 2 ** 53]) {
      expect(tiffinQuoteInputSchema.safeParse(withQty(q)).success).toBe(false);
    }
  });
});

describe("tiffinFlagEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("parses only the flag, fail closed", () => {
    vi.stubEnv("TIFFIN_ENABLED", undefined as unknown as string);
    expect(tiffinFlagEnabled()).toBe(false);
    vi.stubEnv("TIFFIN_ENABLED", "true");
    expect(tiffinFlagEnabled()).toBe(true);
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(tiffinFlagEnabled()).toBe(false);
    vi.stubEnv("TIFFIN_ENABLED", "yes");
    expect(() => tiffinFlagEnabled()).toThrow();
  });
  it("does not need the rest of the environment to be valid", () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    vi.stubEnv("DATABASE_URL", "not-a-url");
    expect(tiffinFlagEnabled()).toBe(true);
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
