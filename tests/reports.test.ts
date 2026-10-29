import { describe, expect, it } from "vitest";
import { reportQuerySchema, type MenuEngineeringQuadrant } from "@/modules/reports/contracts";
import { classifyMenuDish } from "@/modules/reports/menu-classification";
import {
  calculateDelta,
  currencyDecimals,
  escapeCsvCell,
  formatMinutes,
  formatMoney,
  formatMoneyAmount,
  serializeCsv,
} from "@/modules/reports/formatters";

describe("Reports Contracts & Query Parsing", () => {
  it("defaults to today and overview tab when empty", () => {
    const parsed = reportQuerySchema.parse({});
    expect(parsed.range).toBe("today");
    expect(parsed.tab).toBe("overview");
    expect(parsed.fulfillmentMode).toBe("all");
  });

  it("parses valid ranges and tabs", () => {
    const parsed = reportQuerySchema.parse({
      range: "7d",
      tab: "menu",
      fulfillmentMode: "dine_in",
    });
    expect(parsed.range).toBe("7d");
    expect(parsed.tab).toBe("menu");
    expect(parsed.fulfillmentMode).toBe("dine_in");
  });

  it("rejects unknown ranges or tabs", () => {
    expect(() => reportQuerySchema.parse({ range: "invalid-range" })).toThrow();
    expect(() => reportQuerySchema.parse({ tab: "invalid-tab" })).toThrow();
  });
});

describe("Reports Money & Value Formatters", () => {
  it("resolves correct decimal precision per currency", () => {
    expect(currencyDecimals("INR")).toBe(2);
    expect(currencyDecimals("USD")).toBe(2);
    expect(currencyDecimals("OMR")).toBe(3);
    expect(currencyDecimals("JPY")).toBe(0);
  });

  it("formats minor units into currency strings cleanly", () => {
    expect(formatMoney(150000, "INR")).toMatch(/₹\s?1,500\.00/);
    expect(formatMoney(2550, "USD")).toContain("25.50");
    expect(formatMoney(0, "INR")).toMatch(/₹\s?0\.00/);
    expect(formatMoney(null, "INR")).toBe("—");
  });

  it("formats money amounts without currency symbol for CSV export", () => {
    expect(formatMoneyAmount(125000, "INR")).toBe("1,250.00");
    expect(formatMoneyAmount(null, "INR")).toBe("0.00");
  });

  it("formats preparation duration in minutes", () => {
    expect(formatMinutes(14.5)).toBe("14m 30s");
    expect(formatMinutes(8)).toBe("8m");
    expect(formatMinutes(0.5)).toBe("30s");
    expect(formatMinutes(0)).toBe("0m");
  });
});

describe("Period-over-Period Delta Calculation", () => {
  it("computes positive delta with up direction", () => {
    const delta = calculateDelta(120, 100);
    expect(delta.direction).toBe("up");
    expect(delta.percentageChange).toBe(20);
    expect(delta.absolutePaise).toBe(20);
  });

  it("computes negative delta with down direction", () => {
    const delta = calculateDelta(80, 100);
    expect(delta.direction).toBe("down");
    expect(delta.percentageChange).toBe(-20);
    expect(delta.absolutePaise).toBe(-20);
  });

  it("computes flat delta when equal", () => {
    const delta = calculateDelta(100, 100);
    expect(delta.direction).toBe("flat");
    expect(delta.percentageChange).toBe(0);
  });

  it("handles zero baseline safely", () => {
    const delta = calculateDelta(50, 0);
    expect(delta.direction).toBe("up");
    expect(delta.percentageChange).toBeNull();
  });
});

describe("RFC 4180 CSV Serialization", () => {
  it("escapes cells containing commas, quotes, and newlines", () => {
    expect(escapeCsvCell("Simple")).toBe("Simple");
    expect(escapeCsvCell('Paneer "Tikka"')).toBe('"Paneer ""Tikka"""');
    expect(escapeCsvCell("Salt, Pepper")).toBe('"Salt, Pepper"');
    expect(escapeCsvCell("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  it("serializes full headers and rows with CRLF", () => {
    const headers = ["Dish", "Price", "Qty"];
    const rows = [
      ['Butter Chicken, "Special"', "350.00", 12],
      ["Garlic Naan", "60.00", 45],
    ];
    const csv = serializeCsv(headers, rows);
    expect(csv).toContain(
      'Dish,Price,Qty\r\n"Butter Chicken, ""Special""",350.00,12\r\nGarlic Naan,60.00,45'
    );
  });
});

describe("Menu Engineering Kasavana-Smith Matrix Classification", () => {
  function classify(
    qty: number,
    rev: number,
    avgQty: number,
    avgRev: number
  ): MenuEngineeringQuadrant {
    const isHighVolume = qty >= avgQty;
    const isHighRevenue = rev >= avgRev;
    if (isHighVolume && isHighRevenue) return "star";
    if (isHighVolume && !isHighRevenue) return "plowhorse";
    if (!isHighVolume && isHighRevenue) return "puzzle";
    return "dog";
  }

  it("correctly identifies all 4 quadrants", () => {
    const avgQty = 50;
    const avgRev = 15000;

    expect(classify(80, 25000, avgQty, avgRev)).toBe("star");
    expect(classify(90, 8000, avgQty, avgRev)).toBe("plowhorse");
    expect(classify(20, 20000, avgQty, avgRev)).toBe("puzzle");
    expect(classify(15, 4000, avgQty, avgRev)).toBe("dog");
  });
});

describe("Reports security and truthfulness regressions", () => {
  it("validates real calendar dates and rejects reverse or excessive custom intervals", () => {
    expect(
      reportQuerySchema.safeParse({
        range: "custom",
        from: "2026-10-29",
        to: "2026-10-30",
      }).success
    ).toBe(true);
    expect(
      reportQuerySchema.safeParse({
        range: "custom",
        from: "2026-02-30",
        to: "2026-03-01",
      }).success
    ).toBe(false);
    expect(
      reportQuerySchema.safeParse({
        range: "custom",
        from: "2026-10-30",
        to: "2026-10-29",
      }).success
    ).toBe(false);
    expect(
      reportQuerySchema.safeParse({
        range: "custom",
        from: "2025-01-01",
        to: "2026-10-29",
      }).success
    ).toBe(false);
    expect(
      reportQuerySchema.safeParse({
        range: "custom",
        from: "2026-10-29",
      }).success
    ).toBe(false);
  });

  it("neutralizes spreadsheet formulas rather than merely quoting CSV fields", () => {
    for (const input of ["=HYPERLINK(1)", "+SUM(1,2)", "-1+2", "@SUM(A1)", "  =cmd"]) {
      expect(escapeCsvCell(input).startsWith("'") || escapeCsvCell(input).startsWith("\"'")).toBe(
        true
      );
    }
    expect(escapeCsvCell("Plain dish")).toBe("Plain dish");
    expect(formatMoneyAmount(null, "INR")).toBe("");
  });

  it("classifies actual production revenue/popularity helper", () => {
    expect(classifyMenuDish(80, 25000, 50, 15000)).toBe("star");
    expect(classifyMenuDish(90, 8000, 50, 15000)).toBe("plowhorse");
    expect(classifyMenuDish(20, 20000, 50, 15000)).toBe("puzzle");
    expect(classifyMenuDish(15, 4000, 50, 15000)).toBe("dog");
  });
});
