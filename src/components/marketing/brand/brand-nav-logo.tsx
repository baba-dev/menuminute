"use client";

import { useEffect, useState } from "react";

/** Resolved theme is owned by ThemeSync and stored on html[data-theme]. */
type BrandMode = "light" | "dark";

export function BrandNavLogo() {
  const [mode, setMode] = useState<BrandMode | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setMode(root.dataset.theme === "dark" ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Server-render the static variants so the actual logo is present before hydration.
  // The boot theme script sets data-theme before first paint.
  if (mode === null) {
    return (
      <span className="mm-brand-nav-logo mm-brand-nav-logo--fallback" data-testid="brand-nav-logo">
        <img className="mm-brand-nav-logo__light" src="/brand/logos/logo-horizontal-light.svg" alt="" />
        <img className="mm-brand-nav-logo__dark" src="/brand/logos/logo-horizontal-dark.svg" alt="" />
      </span>
    );
  }

  return (
    <span className="mm-brand-nav-logo" data-testid="brand-nav-logo" data-brand-mode={mode}>
      {/* A keyed external SVG runs once on mount and holds its final frame.
          Only a genuine resolved-theme change swaps the object and replays it. */}
      <object
        key={mode}
        type="image/svg+xml"
        data={`/brand/motion/logo-reveal-${mode}-nav.svg`}
        data-testid="brand-nav-motion"
        data-brand-mode={mode}
        aria-hidden="true"
        tabIndex={-1}
        className="mm-brand-nav-logo__motion pointer-events-none"
      >
        <img src={`/brand/logos/logo-horizontal-${mode}.svg`} alt="" />
      </object>
    </span>
  );
}
