"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
  getResolvedAppearance,
  setResolvedAppearance,
  subscribeToAppearance,
  syncResolvedAppearance,
} from "./appearance-store";

const getServerAppearance = () => "light" as const;

/** All mounted theme controls share the same resolved appearance. */
export function ThemeControl() {
  const resolved = useSyncExternalStore(
    subscribeToAppearance,
    getResolvedAppearance,
    getServerAppearance
  );
  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      className="mm-theme-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={() => setResolvedAppearance(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Moon className="h-5 w-5" aria-hidden="true" />
      )}
    </button>
  );
}

/** Keep system mode responsive even on routes without a visible theme toggle. */
export function ThemeSync() {
  useEffect(() => {
    syncResolvedAppearance();
    return subscribeToAppearance(() => {});
  }, []);
  return null;
}
