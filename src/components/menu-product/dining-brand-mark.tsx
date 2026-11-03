import Image from "next/image";
import "@/components/marketing/brand/brand-nav-logo.css";

/**
 * Public-menu brand mark (docs/brand-assets.md). Both logo variants are available so
 * the guest menu remains readable in either appearance. The SVGs honour reduced motion.
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
        className="mm-brand-nav-logo__light"
        src="/brand/motion/logo-reveal-light-nav.svg"
        alt=""
        width={660}
        height={156}
        unoptimized
        priority
      />
      <Image
        className="mm-brand-nav-logo__dark"
        src="/brand/motion/logo-reveal-dark-nav.svg"
        alt=""
        width={660}
        height={156}
        unoptimized
      />
    </span>
  );
}
