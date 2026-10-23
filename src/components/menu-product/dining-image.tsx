"use client";

import { nextVisualSource, type DiningVisual } from "@/modules/menu-product/public-presentation";

/** Keeps browser image-error handling bounded to manifest-controlled paths. */
export function DiningImage({
  visual,
  className,
  eager = false,
}: {
  visual: DiningVisual;
  className?: string;
  eager?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={visual.src}
      className={className}
      src={visual.src}
      alt={visual.alt}
      width={340}
      height={280}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      style={{ objectFit: visual.fit }}
      onError={(event) => {
        const target = event.currentTarget;
        const next = nextVisualSource(visual, target.getAttribute("src") ?? "");
        if (next) {
          target.style.objectFit = "contain";
          target.src = next;
        } else target.onerror = null;
      }}
    />
  );
}
