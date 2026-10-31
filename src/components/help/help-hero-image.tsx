import React from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";

interface HelpHeroImageProps {
  src?: string;
  alt: string;
  caption?: string;
  badge?: string;
}

export function HelpHeroImage({
  src = "/brand/preview/qr-system.webp",
  alt,
  caption,
  badge = "Hospitality Visual Guide",
}: HelpHeroImageProps) {
  return (
    <div className="relative my-8 overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-tr from-orange-100/40 via-amber-50/30 to-stone-100/50 sm:aspect-[21/9] dark:from-stone-950 dark:via-stone-900 dark:to-orange-950/20">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 896px"
          className="object-cover object-center transition-transform duration-500 hover:scale-[1.01]"
          priority
        />
        {badge && (
          <div className="absolute top-4 left-4 z-10">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-stone-900 shadow-md backdrop-blur-md dark:bg-stone-900/90 dark:text-stone-100">
              <Sparkles className="size-3 text-orange-600" />
              <span>{badge}</span>
            </span>
          </div>
        )}
      </div>
      {caption && (
        <div className="border-t border-stone-100 bg-white px-5 py-3 text-center text-xs font-medium text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
          {caption}
        </div>
      )}
    </div>
  );
}
