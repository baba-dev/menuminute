import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Smartphone, ChefHat, ArrowRight, CheckCircle, Star } from "lucide-react";

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

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="border-brand-200 bg-brand-50 text-brand-700 mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium">
            <Star className="fill-brand-500 text-brand-500 h-3.5 w-3.5" />
            Free QR menus for every restaurant
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl lg:text-6xl">
            Your menu, beautifully digital. <span className="text-brand-600">Free forever.</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-stone-600 sm:text-xl">
            Create a stunning digital menu in minutes. Generate a permanent QR code. Let customers
            scan and browse — no app download required. Ordering and Kitchen Pro are in development;
            the free menu works independently.
          </p>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="bg-brand-600 hover:bg-brand-700 inline-flex items-center justify-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Create your free menu
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-8 py-4 text-base font-semibold text-stone-700 transition-all hover:bg-stone-50"
            >
              <QrCode className="h-4 w-4" />
              View live demo
            </Link>
          </div>
        </div>

        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="bg-brand-200/30 absolute top-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl" />
          <div className="absolute right-0 bottom-0 h-64 w-64 rounded-full bg-orange-100/50 blur-3xl" />
        </div>
      </section>

      {/* Free features list */}
      <section className="border-y border-stone-200 bg-white px-4 py-12 sm:px-6 lg:px-8">
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
