import { describe, expect, it } from "vitest";
import { isInternalAssistantPayload } from "../src/modules/intelligence/answer-quality";

describe("Ember human-answer boundary", () => {
  it("rejects raw provider functions and full JSON replies", () => {
    expect(
      isInternalAssistantPayload(
        '{"type":"function","name":"menu_listDishes","parameters":{"menuId":"123"}}'
      )
    ).toBe(true);
    expect(
      isInternalAssistantPayload('```json\n{"function_call":{"name":"orders_pulse"}}\n```')
    ).toBe(true);
    expect(isInternalAssistantPayload('[{"total":42}]')).toBe(true);
  });
  it("keeps readable text, Markdown tables and ordinary quotes", () => {
    expect(isInternalAssistantPayload("**Your kitchen:** 2 active orders.")).toBe(false);
    expect(isInternalAssistantPayload("| Dish | Status |\n|---|---|\n| Chole | Available |")).toBe(
      false
    );
    expect(isInternalAssistantPayload('The menu field is named "name".')).toBe(false);
    expect(isInternalAssistantPayload("{not JSON}")).toBe(false);
  });
});
