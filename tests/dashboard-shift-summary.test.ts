import { describe, expect, it } from "vitest";
import { selectQuestionTools } from "../src/modules/intelligence/tool-selection";
import {
  shiftSummaryPrompt,
  summaryFileName,
  unsupportedFigures,
} from "../src/modules/dashboard/shift-summary";

const evidence = [
  {
    tool: "orders.pulse",
    source: "orders.servicePulse",
    capturedAt: "2027-01-02T09:30:00.000Z",
    data: { pending: 2, preparing: 3, ready: 1, active: 6, completedToday: 41 },
  },
];

describe("shift summary guardrails", () => {
  it("asks only for tool-backed facts and never states or implies sales, allergen or menu claims", () => {
    const prompt = shiftSummaryPrompt("2027-01-02");
    expect(prompt).toContain("2027-01-02");
    expect(prompt).not.toMatch(/\n/);
    expect(prompt).toMatch(/Do not state money amounts/);
    expect(prompt).toMatch(/allergen/);
    expect(prompt.length).toBeLessThan(1200);
  });

  it("routes only to the orders, kitchen and dining-table tools in Ember's tool selection", () => {
    const registry = [
      "orders.pulse",
      "orders.history",
      "kitchen.pulse",
      "menu.summary",
      "tables.pulse",
      "finance.pulse",
      "reports.summary",
      "menu.findDish",
      "imports.pulse",
      "qr.pulse",
    ].map((name) => ({ name }));
    const selected = selectQuestionTools(registry, shiftSummaryPrompt("2027-01-02"))
      .map((tool) => tool.name)
      .sort();
    expect(selected).toEqual(["kitchen.pulse", "orders.pulse", "tables.pulse"]);
  });

  it("accepts figures present in the evidence", () => {
    const draft = "A steady day.\n1. 41 orders completed\n2. 2 awaiting acceptance, 6 active";
    expect(unsupportedFigures(draft, evidence)).toEqual([]);
  });

  it("flags figures that are not in the evidence", () => {
    const draft = "- 41 orders completed\n- Revenue reached 1,250 with 17 covers";
    expect(unsupportedFigures(draft, evidence)).toEqual(["1,250", "17"]);
  });

  it("tolerates quoted times from captured timestamps and missing evidence", () => {
    expect(unsupportedFigures("As of 09:30 we had 3 preparing.", evidence)).toEqual([]);
    expect(unsupportedFigures("No orders yet, 0 pending.", null)).toEqual(["0"]);
  });

  it("builds a safe download name", () => {
    expect(summaryFileName("Café Uno & Sons!", "2027-01-02")).toBe(
      "shift-summary-caf-uno-sons-2027-01-02.txt"
    );
    expect(summaryFileName("###", "")).toBe("shift-summary-outlet-today.txt");
  });
});
