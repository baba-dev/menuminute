// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAppearancePreference,
  getResolvedAppearance,
  setAppearancePreference,
  subscribeToAppearance,
} from "./appearance-store";

let prefersDark = false;
const mediaListeners = new Set<() => void>();

beforeEach(() => {
  prefersDark = false;
  mediaListeners.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return prefersDark;
      },
      addEventListener: (_event: string, listener: () => void) => mediaListeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) =>
        mediaListeners.delete(listener),
    }))
  );
  localStorage.clear();
  setAppearancePreference("system");
});

describe("admin appearance contract", () => {
  it("persists explicit light and dark preferences and applies the selected DOM theme", () => {
    setAppearancePreference("dark");
    expect(getAppearancePreference()).toBe("dark");
    expect(getResolvedAppearance()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("menuminute.appearance")).toBe("dark");
    setAppearancePreference("light");
    expect(getResolvedAppearance()).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("restores OS following and updates only while System is selected", () => {
    setAppearancePreference("system");
    expect(localStorage.getItem("menuminute.appearance")).toBeNull();
    const notify = vi.fn();
    const unsubscribe = subscribeToAppearance(notify);
    prefersDark = true;
    for (const listener of mediaListeners) listener();
    expect(getResolvedAppearance()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    setAppearancePreference("light");
    prefersDark = false;
    for (const listener of mediaListeners) listener();
    expect(getResolvedAppearance()).toBe("light");
    expect(notify).toHaveBeenCalled();
    unsubscribe();
  });

  it("honors a preference updated in another browser tab", () => {
    const notify = vi.fn();
    const unsubscribe = subscribeToAppearance(notify);
    localStorage.setItem("menuminute.appearance", "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "menuminute.appearance" }));
    expect(getAppearancePreference()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(notify).toHaveBeenCalled();
    unsubscribe();
  });
});
