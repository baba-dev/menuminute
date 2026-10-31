import { GUIDES } from "@/content/docs/guides";

type Size = { w: number; h: number };
/** Desktop shots are captured at 1200x750 and mobile at 390x844 (scripts/demo/capture-docs.mjs). */
const DESKTOP: Size = { w: 1200, h: 750 };
const MOBILE: Size = { w: 390, h: 844 };
export const docShotIds = new Set(GUIDES.flatMap((g) => (g.shot ? [g.shot] : [])));
const src = (id: string, variant: string) => `/docs-media/${id}-${variant}.webp`;

/** Theme-aware screenshot: the dark capture is used when the site theme is dark. */
export function DocShot({
  id,
  title,
  priority = false,
}: {
  id: string;
  title: string;
  priority?: boolean;
}) {
  return (
    <figure className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
      {/* Static, pre-optimised WebP files committed to the repository; next/image would re-encode them. */}
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={src(id, "desktop-light")}
        width={DESKTOP.w}
        height={DESKTOP.h}
        alt={`${title}: desktop screenshot of the MenuMinute demo`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full dark:hidden"
      />
      <img
        src={src(id, "desktop-dark")}
        width={DESKTOP.w}
        height={DESKTOP.h}
        alt={`${title}: desktop screenshot of the MenuMinute demo in dark mode`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="hidden h-auto w-full dark:block"
      />
      {/* eslint-enable @next/next/no-img-element */}
    </figure>
  );
}

export function PhoneShot({ id, title }: { id: string; title: string }) {
  return (
    <figure className="border-border bg-card mx-auto w-52 overflow-hidden rounded-[1.75rem] border-4 shadow-md">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src(id, "mobile-light")}
        width={MOBILE.w}
        height={MOBILE.h}
        alt={`${title}: phone-sized screenshot of the MenuMinute demo`}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
    </figure>
  );
}
