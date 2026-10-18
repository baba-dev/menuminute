import { describe, expect, it } from "vitest";
import { ALCHEMY_DURATION_MS, alchemyStage } from "@/components/marketing/alchemy/alchemy-motion";

describe("Menu Alchemy's deterministic nine-second story", () => {
  it("preserves the planned capture, extraction, creation and review sequence", () => {
    expect(ALCHEMY_DURATION_MS).toBe(9000);
    expect([0, 1250, 4200, 7450, 9000].map(alchemyStage)).toEqual([0, 1, 2, 3, 3]);
    expect(alchemyStage(-100)).toBe(0);
    expect(alchemyStage(12000)).toBe(3);
  });
});
