// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getResolvedAppearance, setAppearancePreference } from "./appearance-store";
import { setAppearanceWithTransition, toggleAppearanceWithTransition } from "./appearance-transition";

let reducedMotion = false;
beforeEach(() => {
  reducedMotion = false;
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  Object.defineProperty(document, "startViewTransition", { configurable: true, value: undefined });
  setAppearancePreference("system");
});

describe("animated appearance", () => {
  it("persists and syncs across the app when View Transitions are unavailable", () => {
    setAppearanceWithTransition("dark");
    expect(getResolvedAppearance()).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("menuminute.appearance")).toBe("dark");
    toggleAppearanceWithTransition();
    expect(getResolvedAppearance()).toBe("light");
    expect(localStorage.getItem("menuminute.appearance")).toBe("light");
  });

  it("respects reduced motion even when View Transitions are supported", () => {
    reducedMotion = true;
    const start = vi.fn();
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
    setAppearanceWithTransition("dark");
    expect(start).not.toHaveBeenCalled();
    expect(getResolvedAppearance()).toBe("dark");
  });

  it("reveals from the triggering element and cleans up its scoped CSS flag", async () => {
    let finish!: () => void;
    const done = new Promise<void>((resolve) => { finish = resolve; });
    const start = vi.fn((update: () => void) => {
      update();
      return { ready: Promise.resolve(), finished: done };
    });
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
    const animate = vi.fn();
    const previous = document.documentElement.animate;
    Object.defineProperty(document.documentElement, "animate", { configurable: true, value: animate });
    const anchor = document.createElement("button");
    vi.spyOn(anchor, "getBoundingClientRect").mockReturnValue({
      left: 10, top: 20, width: 40, height: 30, right: 50, bottom: 50,
      x: 10, y: 20, toJSON: () => ({}),
    });
    try {
      setAppearanceWithTransition("dark", anchor);
      expect(start).toHaveBeenCalledOnce();
      expect(getResolvedAppearance()).toBe("dark");
      expect(document.documentElement.dataset.mmThemeTransition).toBe("active");
      await Promise.resolve();
      expect(animate).toHaveBeenCalledWith(
        expect.objectContaining({ clipPath: expect.arrayContaining(["circle(0px at 30px 35px)"]) }),
        expect.objectContaining({ pseudoElement: "::view-transition-new(root)" })
      );
      finish();
      await done;
      await Promise.resolve();
      expect(document.documentElement.dataset.mmThemeTransition).toBeUndefined();
    } finally {
      Object.defineProperty(document.documentElement, "animate", { configurable: true, value: previous });
    }
  });
});
