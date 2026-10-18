import type { Metadata } from "next";
import Link from "next/link";
import { FoodOrbit } from "@/components/marketing/hero/food-orbit";
import { MenuJourney } from "@/components/marketing/journey/menu-journey";
import { QrCode, Smartphone, ChefHat, ArrowRight, Star } from "lucide-react";

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

export default function HomePage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 flex h-8 w-8 items-center justify-center rounded-lg">
                <QrCode className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-stone-900">MenuMinute</span>
            </div>
            <div className="hidden items-center gap-6 md:flex">
              <Link
                href="/pricing"
                className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
              >
                Pricing
              </Link>
              <Link
                href="/demo"
                className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
              >
                Demo
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Get started free
              </Link>
            </div>
            <Link
              href="/register"
              className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors md:hidden"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Food Orbit is the centered focal point, with copy and benefits as supporting elements. */}
      <section className="food-orbit-hero relative isolate overflow-hidden px-4 py-12 sm:px-6 sm:py-16 xl:px-8">
        <div className="food-orbit-hero__layout mx-auto grid max-w-[1500px] items-center gap-4 xl:min-h-[710px] xl:grid-cols-[minmax(0,1fr)_minmax(0,1.78fr)_minmax(0,1fr)] xl:gap-0">
          <div className="food-orbit-hero__intro relative z-10 mx-auto max-w-xl text-center xl:mx-0 xl:pl-4 xl:text-left">
            <p className="food-orbit-hero__eyebrow mb-5 inline-flex items-center gap-2 rounded-full border border-current/20 px-4 py-2 text-xs font-bold tracking-[0.12em] uppercase">
              <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Fresh ideas. Free QR menus.
            </p>
            <h1 className="food-orbit-hero__heading mb-6 text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Your menu, beautifully digital.{" "}
              <span className="food-orbit-hero__eyebrow">Free forever.</span>
            </h1>
            <p className="food-orbit-hero__description mx-auto mb-8 max-w-lg text-base leading-relaxed sm:text-lg xl:mx-0">
              Build your restaurant menu, publish it and share one permanent QR code. Guests scan
              and browse without downloading an app or signing up.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row xl:flex-wrap xl:justify-start">
              <Link
                href="/register"
                className="food-orbit-hero__cta inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-bold transition-transform hover:-translate-y-0.5"
              >
                Create your free menu <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/demo"
                className="food-orbit-hero__secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-7 py-4 text-base font-semibold transition-colors"
              >
                <QrCode className="h-4 w-4" aria-hidden="true" /> View live demo
              </Link>
            </div>
            <p className="food-orbit-hero__micro mt-5 text-xs font-medium">
              No credit card. No guest account. Your restaurant stays the star.
            </p>
          </div>
          <div
            className="food-orbit-hero__stage relative z-0 mx-auto w-full min-w-0"
            data-testid="food-orbit-hero-art"
          >
            <div className="food-orbit-hero__art">
              <FoodOrbit />
            </div>
          </div>
          <aside
            className="food-orbit-hero__benefits hidden flex-col gap-10 pl-6 xl:flex"
            aria-label="Free menu highlights"
          >
            <div className="food-orbit-hero__note">
              <span className="food-orbit-hero__index">01 / CREATE</span>
              <p className="font-semibold">Your restaurant. Your menu.</p>
              <small>Add dishes and preview before publishing.</small>
            </div>
            <div className="food-orbit-hero__note">
              <span className="food-orbit-hero__index">02 / DISPLAY</span>
              <p className="font-semibold">A QR that lasts.</p>
              <small>Permanent menu links, made for the table.</small>
            </div>
            <div className="food-orbit-hero__note">
              <span className="food-orbit-hero__index">03 / EXPLORE</span>
              <p className="font-semibold">Simply scan and browse.</p>
              <small>No customer registration required.</small>
            </div>
          </aside>
        </div>
      </section>

      {/* From your kitchen to their fingertips: replaces the old free-plan checklist. */}
      <MenuJourney />

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
