"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getAppearancePreference,
  setAppearancePreference,
  subscribeToAppearance,
  type AppearancePreference,
} from "@/components/menu-product/appearance-store";

/** Admin appearance is explicit: light, dark, or follow the operating system. */
export function AdminAppearanceControl() {
  const preference = useSyncExternalStore(
    subscribeToAppearance,
    getAppearancePreference,
    () => "system" as AppearancePreference
  );
  return (
    <label className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-2 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
      {preference === "dark" ? (
        <Moon aria-hidden="true" className="h-4 w-4" />
      ) : preference === "light" ? (
        <Sun aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Monitor aria-hidden="true" className="h-4 w-4" />
      )}
      <span className="sr-only">Appearance preference</span>
      <select
        aria-label="Appearance preference"
        className="max-w-20 cursor-pointer bg-transparent text-xs font-semibold outline-offset-2 sm:max-w-none"
        value={preference}
        onChange={(event) => setAppearancePreference(event.target.value as AppearancePreference)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
