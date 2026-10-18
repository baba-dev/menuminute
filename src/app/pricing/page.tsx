import type { Metadata } from "next";
import Link from "next/link";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { CheckCircle, QrCode } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free permanent QR menus today. Upcoming ordering and kitchen plans have no finalized prices.",
};

const plans = [
  {
    name: "Free Forever",
    price: "Free",
    period: "forever",
    description: "Everything you need to go digital with a beautiful QR menu.",
    cta: "Get started free",
    ctaHref: "/register",
    primary: false,
    features: [
      "Categories, dishes and descriptions",
      "Menu categories and variants",
      "Item photos and descriptions",
      "Permanent QR code",
      "Mobile-optimised menu view",
      "No customer registration",
      "Restaurant identity",
    ],
  },
  {
    name: "Online Ordering",
    price: "TBA",
    period: "Terms pending",
    description: "Planned: dine-in and pickup with merchant acceptance. Not available yet.",
    cta: "Coming soon",
    ctaHref: "#",
    primary: true,
    soon: true,
    features: [
      "Everything in Free",
      "Table-based QR ordering",
      "Cart and order submission",
      "Order management dashboard",
      "Customer order tracking",
      "Order history and reports",
    ],
  },
  {
    name: "Kitchen Pro",
    price: "TBA",
    period: "Terms pending",
    description: "Planned kitchen tickets and preparation workflow. Not available yet.",
    cta: "Coming soon",
    ctaHref: "#",
    primary: false,
    soon: true,
    features: [
      "Everything in Ordering",
      "Live kitchen display system",
      "Order acceptance workflow",
      "Audible notifications",
      "Staff management",
      "Kitchen device management",
      "Operational reports",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-brand-600 flex h-8 w-8 items-center justify-center rounded-lg">
                <QrCode className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-stone-900">MenuMinute</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeControl />
              <Link
                href="/login"
                className="hidden text-sm font-medium text-stone-600 hover:text-stone-900 sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                <span className="sm:hidden">Start free</span>
                <span className="hidden sm:inline">Get started free</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-stone-900">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-2xl text-xl text-stone-600">
            Free QR menus are available now. Ordering and Kitchen Pro pricing and subscription terms
            are not finalized.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 ${
                plan.primary
                  ? "bg-brand-600 ring-brand-600 text-white ring-2"
                  : "border border-stone-200 bg-white"
              }`}
            >
              {plan.soon && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white">
                  Coming soon
                </div>
              )}
              <h3
                className={`mb-2 text-lg font-bold ${plan.primary ? "text-white" : "text-stone-900"}`}
              >
                {plan.name}
              </h3>
              <div className="mb-4">
                <span
                  className={`text-4xl font-bold ${plan.primary ? "text-white" : "text-stone-900"}`}
                >
                  {plan.price}
                </span>
                <span
                  className={`ml-1 text-sm ${plan.primary ? "text-brand-100" : "text-stone-500"}`}
                >
                  {plan.period}
                </span>
              </div>
              <p className={`mb-6 text-sm ${plan.primary ? "text-brand-100" : "text-stone-600"}`}>
                {plan.description}
              </p>
              {plan.soon ? (
                <span
                  aria-disabled="true"
                  className="mb-8 block w-full cursor-not-allowed rounded-xl bg-stone-100 py-3 text-center text-sm font-semibold text-stone-600"
                >
                  Coming soon · pricing pending
                </span>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="bg-brand-600 hover:bg-brand-700 mb-8 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white transition-colors"
                >
                  {plan.cta}
                </Link>
              )}
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle
                      className={`mt-0.5 h-4 w-4 shrink-0 ${plan.primary ? "text-brand-200" : "text-green-500"}`}
                    />
                    <span className={plan.primary ? "text-brand-100" : "text-stone-700"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
