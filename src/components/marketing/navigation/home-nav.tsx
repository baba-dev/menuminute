import Link from "next/link";
import { BrandNavLogo } from "@/components/marketing/brand/brand-nav-logo";
import { HomeAuthActions } from "@/components/marketing/hero/home-auth-actions";
import { HomeMobileNavigation } from "@/components/marketing/hero/home-mobile-navigation";
import { ThemeControl } from "@/components/menu-product/theme-control";
import "@/components/marketing/brand/brand-nav-logo.css";
import "@/components/marketing/hero/food-orbit.css";

/**
 * The homepage navigation bar: logo, links, account actions and the appearance toggle (plus the
 * phone menu). One component, used by `/` and `/home-v2`, so the two cannot drift. Its look comes
 * from the `food-orbit-hero__nav*` rules, so it must sit inside `.mm-homepage` for the layout rule
 * in `home-layout.css`.
 */
export function HomeNav() {
  return (
    <nav aria-label="Main navigation" className="food-orbit-hero__nav relative z-20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="MenuMinute home">
          <BrandNavLogo />
        </Link>
        <div className="hidden items-center gap-5 md:flex lg:gap-7">
          <Link href="/pricing" className="food-orbit-hero__nav-link text-sm font-medium">
            Pricing
          </Link>
          <Link href="/demo" className="food-orbit-hero__nav-link text-sm font-medium">
            Demo
          </Link>
          <Link href="/help" className="food-orbit-hero__nav-link text-sm font-medium">
            Guides
          </Link>
          <HomeAuthActions />
          <ThemeControl />
        </div>
        <HomeMobileNavigation />
      </div>
    </nav>
  );
}
