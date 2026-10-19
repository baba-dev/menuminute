import type { Metadata } from "next";
import Link from "next/link";
import { FoodOrbit } from "@/components/marketing/hero/food-orbit";
import { MenuJourney } from "@/components/marketing/journey/menu-journey";
import { MenuAlchemy } from "@/components/marketing/alchemy/menu-alchemy";
import { OrderConveyor } from "@/components/marketing/order-conveyor/order-conveyor";
import { ChefPass } from "@/components/marketing/chef-pass/chef-pass";
import { StorefrontStudio } from "@/components/marketing/storefront-studio/storefront-studio";
import { STICKER_DEMO_URL } from "@/components/marketing/storefront-studio/sticker-config";
import QRCode from "qrcode";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { BrandNavLogo } from "@/components/marketing/brand/brand-nav-logo";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "@/components/marketing/brand/brand-nav-logo.css";
import { QrCode, Smartphone, ChefHat, Menu } from "lucide-react";

export const metadata: Metadata = {
  title: "MenuMinute — Free QR Menus for Restaurants",
  description:
    "Create and publish a free digital menu with permanent QR codes. Online ordering and Kitchen Pro are in development.",
};

const features = [
  {
    icon: QrCode,
    title: "Free QR Menus",
    description:
      "Create a beautiful digital menu in minutes. Generate a permanent QR code your customers can scan to browse your menu — completely free, forever.",
    badge: "Free Forever",
    badgeColor: "bg-green-100 text-green-700",
  },
  {
    icon: Smartphone,
    title: "Online Ordering",
    description:
      "Planned: table and pickup orders with merchant acceptance. Not available in the free QR menu today.",
    badge: "In development",
    badgeColor: "bg-brand-100 text-brand-700",
    soon: true,
  },
  {
    icon: ChefHat,
    title: "Kitchen Pro",
    description:
      "Planned: recoverable kitchen tickets and preparation workflow. Not yet available.",
    badge: "In development",
    badgeColor: "bg-stone-100 text-stone-700",
    soon: true,
  },
];

export default async function HomePage() {
  const qrDataUrl = await QRCode.toDataURL(STICKER_DEMO_URL, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 4,
    scale: 8,
    color: { dark: "#101820", light: "#ffffff" },
  });
  return (
    <div className="min-h-screen bg-stone-50">
      {/* The navigation is part of the hero, not a separate sticky toolbar. */}
      <section className="food-orbit-hero relative isolate overflow-hidden">
        <nav aria-label="Main navigation" className="food-orbit-hero__nav relative z-20">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5"
              aria-label="MenuMinute home"
            >
              <BrandNavLogo />
            </Link>
            <div className="hidden items-center gap-5 md:flex lg:gap-7">
              <Link href="/pricing" className="food-orbit-hero__nav-link text-sm font-medium">
                Pricing
              </Link>
              <Link href="/demo" className="food-orbit-hero__nav-link text-sm font-medium">
                Demo
              </Link>
              <Link href="/login" className="food-orbit-hero__nav-link text-sm font-medium">
                Sign in
              </Link>
              <Link
                href="/register"
                className="food-orbit-hero__nav-cta inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
              >
                Get started free
              </Link>
              <ThemeControl />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeControl />
              <details className="food-orbit-hero__mobile-menu relative">
                <summary
                  aria-label="Open navigation menu"
                  className="food-orbit-hero__icon-button flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </summary>
                <div className="food-orbit-hero__mobile-panel absolute top-full right-0 z-30 mt-2 flex w-52 flex-col gap-1 rounded-2xl border p-2 shadow-xl">
                  <Link href="/pricing" className="food-orbit-hero__mobile-link">
                    Pricing
                  </Link>
                  <Link href="/demo" className="food-orbit-hero__mobile-link">
                    Demo
                  </Link>
                  <Link href="/login" className="food-orbit-hero__mobile-link">
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    className="food-orbit-hero__nav-cta mt-1 rounded-xl px-4 py-3 text-center text-sm font-bold"
                  >
                    Get started free
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </nav>

        <div className="food-orbit-hero__content relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <h1 className="food-orbit-hero__heading text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your menu, beautifully digital.
            <span className="food-orbit-hero__accent block">Free forever.</span>
          </h1>
          <div className="food-orbit-hero__stage w-full min-w-0" data-testid="food-orbit-hero-art">
            <div className="food-orbit-hero__art">
              <FoodOrbit />
            </div>
          </div>
          <p className="food-orbit-hero__description max-w-2xl text-base leading-relaxed sm:text-lg">
            Build your restaurant menu, publish it and share one permanent QR code. Guests scan and
            browse without downloading an app or signing up.
          </p>
          <div className="food-orbit-hero__divider" aria-hidden="true" />
        </div>
      </section>

      {/* A three-stage illustrated story, following the Food Orbit hero. */}
      <MenuJourney />

      {/* Editorial preview of planned smart import; no inference runs on this page. */}
      <MenuAlchemy />

      {/* Section 4: illustrated preview of future dine-in and pickup ordering. */}
      <OrderConveyor />

      {/* Section 5: illustrated multi-station Kitchen Pro concept, not a live KDS. */}
      <ChefPass />

      {/* Product choices after the illustrated onboarding story. */}
      <section id="features" className="ma-product-features px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-stone-900 sm:text-4xl">
              Start free. Grow as you need.
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-stone-600">
              Begin with a free digital menu today. Ordering and kitchen products are upcoming;
              their subscription terms have not been finalized.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`relative rounded-2xl border bg-white p-8 transition-shadow hover:shadow-md ${
                    feature.soon ? "opacity-80" : ""
                  }`}
                >
                  {feature.soon && (
                    <div className="absolute top-4 right-4 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-500">
                      Coming soon
                    </div>
                  )}
                  <div className="mb-6">
                    <div className="bg-brand-50 mb-4 flex h-12 w-12 items-center justify-center rounded-xl">
                      <Icon className="text-brand-600 h-6 w-6" />
                    </div>
                    <div className="mb-3 flex items-center gap-3">
                      <h3 className="text-xl font-bold text-stone-900">{feature.title}</h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${feature.badgeColor}`}
                      >
                        {feature.badge}
                      </span>
                    </div>
                    <p className="leading-relaxed text-stone-600">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 7 — original illustrated, interactive storefront sticker collection. */}
      <StorefrontStudio qrDataUrl={qrDataUrl} />

      <PublicFooter />
    </div>
  );
}
