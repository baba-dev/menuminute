import { describe, expect, it } from "vitest";
import { executeReadTool } from "../src/modules/intelligence/read-tools";
import { groundedMerchantAnswer } from "../src/modules/intelligence/grounded-answer";
import { selectQuestionTools } from "../src/modules/intelligence/tool-selection";

const ctx = {} as Parameters<typeof executeReadTool>[0];
const names = [
  "orders.pulse",
  "menu.summary",
  "reports.summary",
  "menu.findDish",
  "kitchen.pulse",
  "orders.history",
  "tables.pulse",
  "qr.pulse",
  "help.search",
].map((name) => ({ name }));

describe("Ember help knowledge", () => {
  it("returns published FAQ answers alongside guides and never diner-only guides", async () => {
    const r = await executeReadTool(ctx, "help.search", { query: "free commission" });
    const data = r.data as {
      faqs: Array<{ answer: string }>;
      matches: Array<{ audience: string }>;
    };
    expect(data.faqs.length).toBeGreaterThan(0);
    expect(data.matches.every((m) => m.audience !== "customer")).toBe(true);
  });
  it("answers a pricing question from the FAQ in plain language", async () => {
    const r = await executeReadTool(ctx, "help.search", { query: "is it free commission" });
    const answer = groundedMerchantAnswer("Is MenuMinute free?", [
      { tool: "help.search", capturedAt: new Date().toISOString(), ...r },
    ] as never);
    expect(answer).toMatch(/free|commission/i);
    expect(answer).not.toMatch(/help\.knowledgeBase|"faqs"|\{/);
  });
  it("routes product questions to help but live-fact questions elsewhere", () => {
    expect(selectQuestionTools(names, "Does MenuMinute charge commission?")[0]?.name).toBe(
      "help.search"
    );
    expect(selectQuestionTools(names, "What are my orders right now?")[0]?.name).toBe(
      "orders.pulse"
    );
    expect(selectQuestionTools(names, "How much sale this week?")[0]?.name).toBe("reports.summary");
    expect(selectQuestionTools(names, "Tell me something")).toContainEqual({ name: "help.search" });
  });
});
