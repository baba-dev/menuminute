/**
 * Single source of truth for the resolved browser appearance.
 *
 * The inline bootstrap script applies the initial theme before first paint.
 * This store keeps every mounted switch in sync after hydration, across
 * breakpoints, system-preference changes and storage events from other tabs.
 */
export type ResolvedAppearance = "light" | "dark";

const STORAGE_KEY = "menuminute.appearance";
const CHANGE_EVENT = "menuminute:appearance-change";

// Retain manual changes when the browser denies access to localStorage.
let inMemoryPreference: ResolvedAppearance | null = null;

export function getResolvedAppearance(): ResolvedAppearance {
  if (typeof window === "undefined") return "light";
  let selected: string | null = inMemoryPreference;
  if (!selected) {
    try {
      selected = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private browsing or policy can make storage unavailable.
    }
  }
  if (selected === "dark" || selected === "light") return selected;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function syncResolvedAppearance(): ResolvedAppearance {
  const resolved = getResolvedAppearance();
  document.documentElement.dataset.theme = resolved;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function setResolvedAppearance(next: ResolvedAppearance): void {
  inMemoryPreference = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The in-memory preference is still applied for this tab.
  }
  syncResolvedAppearance();
  window.dispatchEvent(new Event(CHANGE_EVENT));
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
