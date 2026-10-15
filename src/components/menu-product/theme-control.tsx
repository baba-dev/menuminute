"use client";
import { useEffect, useState } from "react";
export function ThemeControl() {
  const [value, setValue] = useState("system");
  useEffect(() => {
    const stored = localStorage.getItem("menuminute.appearance") ?? "system";
    queueMicrotask(() => setValue(stored));
    const query = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const selected = localStorage.getItem("menuminute.appearance") ?? "system";
      document.documentElement.dataset.theme =
        selected === "system" ? (query.matches ? "dark" : "light") : selected;
    };
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return (
    <label className="appearance">
      Appearance
      <select
        aria-label="Appearance"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          localStorage.setItem("menuminute.appearance", v);
          document.documentElement.dataset.theme =
            v === "system"
              ? matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : v;
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
