import Image from "next/image";
import "@/components/marketing/brand/brand-nav-logo.css";

/**
 * Public-menu brand mark (docs/brand-assets.md). The cover always sits on a light paper
 * wash, so the light variant is fixed and the reveal plays once on load and holds its
 * final frame; there is no theme replay to key on. The SVG honours prefers-reduced-motion.
 *
 * Rendered as <img>, not <object>: the site CSP sets `object-src 'none'`, which blocks the
 * <object> embed used by the marketing nav logo. SVG animation still runs inside <img>.
 */
export function DiningBrandMark() {
  return (
    <span
      className="mm-brand-nav-logo dining-brand-mark"
      role="img"
      aria-label="Powered by MenuMinute"
      data-testid="dining-brand-mark"
    >
      <Image
        src="/brand/motion/logo-reveal-light-nav.svg"
        alt=""
        width={660}
        height={156}
        unoptimized
        priority
      />
    </span>
  );
}
