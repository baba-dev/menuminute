import { describe, expect, it } from "vitest";
import { selectQuestionTools } from "../src/modules/intelligence/tool-selection";
import { weekWindow } from "../src/modules/intelligence/merchant-tools";
import { toolDefinitions, executeReadTool } from "../src/modules/intelligence/read-tools";

const names = toolDefinitions();

describe("Ember merchant intelligence routing and business dates", () => {
  it("selects the right report source, not the current-order pulse alone", () => {
    const chosen = selectQuestionTools(names, "How much sale this week?");
    expect(chosen[0]?.name).toBe("reports.summary");
    expect(chosen.length).toBeLessThanOrEqual(8);
  });
  it("selects published dish search for item questions", () => {
    const chosen = selectQuestionTools(names, "Do I sell chole bhature?");
    expect(chosen[0]?.name).toBe("menu.findDish");
    expect(chosen.map((x) => x.name)).not.toContain("finance.pulse");
  });
  it("selects private import and QR summary tools without arbitrary output", () => {
    expect(selectQuestionTools(names, "Any failed menu imports?")[0]?.name).toBe("imports.pulse");
    expect(selectQuestionTools(names, "Any failed menu import?")[0]?.name).toBe("imports.pulse");
    expect(selectQuestionTools(names, "How many QR codes?")[0]?.name).toBe("qr.pulse");
    expect(selectQuestionTools(names, "Help me")[0]?.name).toBe("help.search");
    expect(selectQuestionTools(names, "How do I print a table QR?")[0]?.name).toBe("help.search");
    expect(selectQuestionTools(names, "How can I mark a dish as sold out?")[0]?.name).toBe(
      "help.search"
    );
    expect(selectQuestionTools(names, "How many QR codes?")[0]?.name).toBe("qr.pulse");
    expect(selectQuestionTools(names, "How much sale this week?")[0]?.name).toBe("reports.summary");
  });
  it("uses the outlet calendar week across timezones, not server time", () => {
    const clock = new Date("2026-10-25T22:30:00Z"); // India Monday; UTC Sunday
    expect(weekWindow("Asia/Kolkata", clock)).toEqual({ from: "2026-10-26", to: "2026-10-26" });
    expect(weekWindow("America/New_York", clock)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
  });
  it("never advertises a generic model command, shell, web fetch or write tool", () => {
    expect(names.map((x) => x.name)).toContain("reports.summary");
    expect(names.map((x) => x.name)).toContain("menu.findDish");
    expect(names.every((x) => !/(write|delete|sql|fetch|refund|publish)/.test(x.name))).toBe(true);
  });
  it("rejects unknown calls without running any business service", async () => {
    const fake = { actor: { userId: "x" }, organizationId: "other", outletId: "outlet" };
    await expect(executeReadTool(fake, "arbitrary.http", {})).rejects.toThrow(
      "Unknown read-only tool"
    );
  });
});
