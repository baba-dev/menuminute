"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** Use the bootstrapped resolved theme; one click opts out of automatic system mode. */
export function ThemeControl() {
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const selected = localStorage.getItem("menuminute.appearance") ?? "system";
      const next = selected === "system" ? (query.matches ? "dark" : "light") : selected;
      const mode = next === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = mode;
      setResolved(mode);
    };
    queueMicrotask(sync);
    query.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isDark = resolved === "dark";
  return (
    <button
      type="button"
      className="mm-theme-toggle inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      onClick={() => {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem("menuminute.appearance", next);
        document.documentElement.dataset.theme = next;
        setResolved(next);
      }}
    >
      {isDark ? <Sun className="h-5 w-5" aria-hidden="true" /> : <Moon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}

/** Keep System mode responsive even on routes without a visible theme toggle. */
export function ThemeSync() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const selected = localStorage.getItem("menuminute.appearance") ?? "system";
      document.documentElement.dataset.theme =
        selected === "system" ? (query.matches ? "dark" : "light") : selected === "dark" ? "dark" : "light";
    };
    query.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return null;
}
