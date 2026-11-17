"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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
        <Image
          className="mm-brand-nav-logo__light"
          src="/brand/logos/logo-horizontal-light.svg"
          alt=""
          width={660}
          height={156}
          unoptimized
        />
        <Image
          className="mm-brand-nav-logo__dark"
          src="/brand/logos/logo-horizontal-dark.svg"
          alt=""
          width={660}
          height={156}
          unoptimized
        />
      </span>
    );
  }

  return (
    <span className="mm-brand-nav-logo" data-testid="brand-nav-logo" data-brand-mode={mode}>
      {/* A keyed external SVG runs once on mount and holds its final frame; only a genuine
          resolved-theme change swaps the image and replays it. This is an <img>, not an
          <object>: the site CSP sets `object-src 'none'`, which blocked the embed (and logged a
          violation on every page). CSS animation inside the SVG still runs in an <img>. */}
      <Image
        key={mode}
        src={`/brand/motion/logo-reveal-${mode}-nav.svg`}
        alt=""
        width={660}
        height={156}
        unoptimized
        priority
        data-testid="brand-nav-motion"
        data-brand-mode={mode}
        className="mm-brand-nav-logo__motion pointer-events-none"
      />
    </span>
  );
}
