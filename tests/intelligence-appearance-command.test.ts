import { describe, expect, it } from "vitest";
import { parseAppearanceCommand } from "../src/modules/intelligence/appearance-command";

describe("Ember's browser appearance skill", () => {
  it.each([
    ["switch to dark mode", "dark"],
    ["Ember, please turn on dark mode!", "dark"],
    ["Please set the theme to light.", "light"],
    ["make it dark", "dark"],
    ["turn off dark mode", "light"],
    ["use system theme", "system"],
    ["follow my device settings", "system"],
    ["reset theme to system", "system"],
    ["toggle the theme", "toggle"],
    ["switch color mode", "toggle"],
  ] as const)("recognizes %s", (input, result) => {
    expect(parseAppearanceCommand(input)).toBe(result);
  });

  it.each([
    "Does MenuMinute have dark mode?",
    "How does dark mode work?",
    "Explain how to change the theme",
    "Switch the guests menu to dark mode",
    "Turn off dark mode for everybody",
    "What color is the kitchen status indicator?",
  ])("does not mistake normal questions or business requests for appearance changes", (input) => {
    expect(parseAppearanceCommand(input)).toBeNull();
  });
});
