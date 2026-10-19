"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ResolvedTheme = "light" | "dark";

/**
 * External SVG animation runs once per <img> mount, then holds its last frame.
 * Only the resolved document color theme controls remounting; unrelated nav
 * renders, storage events and React state changes must not replay the logo.
 */
export function AnimatedNavBrand() {
  const [theme, setTheme] = useState<ResolvedTheme | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const next: ResolvedTheme = root.dataset.theme === "dark" ? "dark" : "light";
      setTheme((current) => (current === next ? current : next));
    };

    // The inline theme bootstrap runs before hydration. The static placeholder
    // is theme-correct even before the animated image mounts.
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <span className="mm-nav-brand relative block h-[49px] w-[200px] shrink-0 sm:h-[54px] sm:w-[220px]">
      {theme === null ? (
        <span className="mm-nav-brand__static block h-full w-full" aria-hidden="true" />
      ) : (
        <Image
          key={theme}
          data-testid="animated-nav-logo"
          data-logo-theme={theme}
          src={`/brand/motion/nav-${theme}-transparent.svg`}
          alt=""
          width={650}
          height={159}
          priority
          unoptimized
          className="block h-full w-full object-contain"
          draggable={false}
        />
      )}
    </span>
  );
}
