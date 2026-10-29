/**
 * Single source of truth for the resolved browser appearance.
 *
 * The inline bootstrap script applies the initial theme before first paint.
 * This store keeps every mounted switch in sync after hydration, across
 * breakpoints, system-preference changes and storage events from other tabs.
 */
export type ResolvedAppearance = "light" | "dark";
export type AppearancePreference = ResolvedAppearance | "system";

const STORAGE_KEY = "menuminute.appearance";
const CHANGE_EVENT = "menuminute:appearance-change";

// Retain manual changes when the browser denies access to localStorage.
let inMemoryPreference: AppearancePreference | null = null;

/** Explicit choice is distinct from the effective browser theme. */
export function getAppearancePreference(): AppearancePreference {
  if (typeof window === "undefined") return "system";
  if (inMemoryPreference) return inMemoryPreference;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // Storage may be disabled; default to the OS preference.
  }
  return "system";
}

export function getResolvedAppearance(): ResolvedAppearance {
  if (typeof window === "undefined") return "light";
  const selected = getAppearancePreference();
  if (selected !== "system") return selected;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function syncResolvedAppearance(): ResolvedAppearance {
  const resolved = getResolvedAppearance();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

/** Persist an explicit override, or resume following operating-system appearance. */
export function setAppearancePreference(next: AppearancePreference): void {
  inMemoryPreference = next;
  try {
    if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Keep the choice for this tab even without storage access.
  }
  syncResolvedAppearance();
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setResolvedAppearance(next: ResolvedAppearance): void {
  setAppearancePreference(next);
}

/** useSyncExternalStore subscription; also used by the root theme synchronizer. */
export function subscribeToAppearance(notify: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const syncAndNotify = () => {
    syncResolvedAppearance();
    notify();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    inMemoryPreference = null;
    syncAndNotify();
  };
  media.addEventListener("change", syncAndNotify);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, syncAndNotify);
  return () => {
    media.removeEventListener("change", syncAndNotify);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, syncAndNotify);
  };
}
