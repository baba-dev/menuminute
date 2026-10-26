"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

export type SupplementaryArtwork =
  | "welcome-hero-desktop"
  | "welcome-hero-mobile"
  | "gps-locator"
  | "empty-outlet"
  | "celebration-overlay";

/** Optional in-repository artwork. Never displays a broken image when assets are not yet uploaded. */
export function ThemedArtwork({
  name,
  width,
  height,
  className = "",
}: {
  name: SupplementaryArtwork;
  width: number;
  height: number;
  className?: string;
}) {
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  return (
    <div
      className={`wizard-themed-art ${className}`.trim()}
      aria-hidden="true"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <div className="wizard-themed-placeholder">
        <ImageIcon size={36} aria-hidden="true" />
      </div>
      {(["light", "dark"] as const).map((theme) =>
        errors[theme] ? null : (
          <Image
            key={theme}
            className={`wizard-themed-image wizard-themed-image--${theme}`}
            src={`/brand/onboarding-wizard/${name}-${theme}.webp`}
            alt=""
            width={width}
            height={height}
            unoptimized
            onError={() => setErrors((previous) => ({ ...previous, [theme]: true }))}
          />
        )
      )}
    </div>
  );
}
