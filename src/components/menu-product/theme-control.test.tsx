// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAppearancePreference } from "./appearance-store";
import { ThemeControl } from "./theme-control";

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: undefined,
  });
  window.localStorage.clear();
  setAppearancePreference("system");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("guest-facing appearance switch", () => {
  it("toggles the resolved theme with accessible labels and persists the choice", () => {
    render(<ThemeControl />);
    const darkButton = screen.getByRole("button", { name: "Switch to dark mode" });
    expect(darkButton.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(darkButton);
    const lightButton = screen.getByRole("button", { name: "Switch to light mode" });
    expect(lightButton.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("menuminute.appearance")).toBe("dark");

    fireEvent.click(lightButton);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("menuminute.appearance")).toBe("light");
  });

  it("restores a saved preference after the control remounts", () => {
    setAppearancePreference("dark");
    const { unmount } = render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
    unmount();
    render(<ThemeControl />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
  });
});
