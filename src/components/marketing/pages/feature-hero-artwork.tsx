import Image from "next/image";
import type { MarketingFeature } from "@/content/marketing/features";

/**
 * Branded artwork already used by the private workspace.
 * We reuse repository-local WebP assets, never fetch personal restaurant data.
 */
export function FeatureHeroArtwork({ feature }: { feature: MarketingFeature }) {
  const art = feature.heroArtwork;
  return (
    <figure className="border-border bg-muted relative isolate mt-12 overflow-hidden rounded-[2rem] border shadow-xl shadow-stone-950/5">
      <div className="relative hidden h-[260px] sm:block lg:h-[340px]">
        <Image
          src={art.desktopLight}
          alt={art.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover object-center dark:hidden"
        />
        <Image
          src={art.desktopDark}
          alt={art.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="hidden object-cover object-center dark:block"
        />
      </div>
      <div className="relative h-[390px] sm:hidden">
        <Image
          src={art.mobileLight}
          alt={art.alt}
          fill
          sizes="100vw"
          className="object-cover object-center dark:hidden"
        />
        <Image
          src={art.mobileDark}
          alt={art.alt}
          fill
          sizes="100vw"
          className="hidden object-cover object-center dark:block"
        />
      </div>
      <figcaption className="border-border bg-card text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs">
        <span>{art.label}</span>
        <span>Original MenuMinute workspace artwork</span>
      </figcaption>
    </figure>
  );
}
