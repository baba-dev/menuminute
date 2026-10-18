import type { Metadata } from "next";
import Link from "next/link";
import { FoodOrbit } from "@/components/marketing/hero/food-orbit";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { QrCode, Smartphone, ChefHat, ArrowRight, CheckCircle, Menu } from "lucide-react";

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

const freeFeatures = [
  "Categories, dishes and descriptions",
  "Menu categories and variants",
  "Item photos and descriptions",
  "Permanent QR code generation",
  "Mobile-optimised customer view",
  "No customer registration required",
  "Your restaurant identity",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* The navigation is part of the hero, not a separate sticky toolbar. */}
      <section className="food-orbit-hero relative isolate overflow-hidden">
        <nav aria-label="Main navigation" className="food-orbit-hero__nav relative z-20">
          <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="MenuMinute home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
                <QrCode className="h-4 w-4 text-white" aria-hidden="true" />
              </span>
              <span className="food-orbit-hero__brand text-lg font-extrabold tracking-tight">MenuMinute</span>
            </Link>
            <div className="hidden items-center gap-5 md:flex lg:gap-7">
              <Link href="/pricing" className="food-orbit-hero__nav-link text-sm font-medium">Pricing</Link>
              <Link href="/demo" className="food-orbit-hero__nav-link text-sm font-medium">Demo</Link>
              <Link href="/login" className="food-orbit-hero__nav-link text-sm font-medium">Sign in</Link>
              <Link href="/register" className="food-orbit-hero__nav-cta inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold">Get started free</Link>
              <ThemeControl />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <ThemeControl />
              <details className="food-orbit-hero__mobile-menu relative">
                <summary aria-label="Open navigation menu" className="food-orbit-hero__icon-button flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </summary>
                <div className="food-orbit-hero__mobile-panel absolute top-full right-0 z-30 mt-2 flex w-52 flex-col gap-1 rounded-2xl border p-2 shadow-xl">
                  <Link href="/pricing" className="food-orbit-hero__mobile-link">Pricing</Link>
                  <Link href="/demo" className="food-orbit-hero__mobile-link">Demo</Link>
                  <Link href="/login" className="food-orbit-hero__mobile-link">Sign in</Link>
                  <Link href="/register" className="food-orbit-hero__nav-cta mt-1 rounded-xl px-4 py-3 text-center text-sm font-bold">Get started free</Link>
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
            <div className="food-orbit-hero__art"><FoodOrbit /></div>
          </div>
          <p className="food-orbit-hero__description max-w-2xl text-base leading-relaxed sm:text-lg">
            Build your restaurant menu, publish it and share one permanent QR code. Guests scan and
            browse without downloading an app or signing up.
          </p>
          <div className="food-orbit-hero__divider" aria-hidden="true" />
        </div>
      </section>

      {/* Free features list */}
      <section className="food-orbit-hero__next border-b border-stone-200 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="mb-8 text-center text-sm font-semibold tracking-wider text-stone-500 uppercase">
            Everything in the free plan
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {freeFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
                <span className="text-sm text-stone-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
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

      {/* CTA */}
      <section className="bg-brand-600 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">Ready to go digital?</h2>
          <p className="text-brand-100 mb-8 text-lg">
            Create your outlet, add dishes, review your menu and print a permanent QR when you
            publish.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="text-brand-700 hover:bg-brand-50 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold transition-all"
            >
              Create your free menu
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="border-brand-400 hover:bg-brand-700 inline-flex items-center justify-center rounded-xl border px-8 py-4 text-base font-semibold text-white transition-all"
            >
              See it in action
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-stone-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 flex h-7 w-7 items-center justify-center rounded-lg">
                <QrCode className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="font-bold text-white">MenuMinute</span>
            </div>
            <div className="flex gap-8">
              <Link
                href="/pricing"
                className="text-sm text-stone-400 transition-colors hover:text-white"
              >
                Pricing
              </Link>
              <Link
                href="/demo"
                className="text-sm text-stone-400 transition-colors hover:text-white"
              >
                Demo
              </Link>
              <Link
                href="/login"
                className="text-sm text-stone-400 transition-colors hover:text-white"
              >
                Sign in
              </Link>
            </div>
            <p className="text-sm text-stone-500">
              © {new Date().getFullYear()} MenuMinute. Built with ♥ for restaurants.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
