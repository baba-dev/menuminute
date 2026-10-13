import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle, QrCode } from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for restaurants of all sizes. Start free, upgrade when you're ready.",
};

const plans = [
  {
    name: "Free Forever",
    price: "₹0",
    period: "forever",
    description: "Everything you need to go digital with a beautiful QR menu.",
    cta: "Get started free",
    ctaHref: "/register",
    primary: false,
    features: [
      "Unlimited menu items",
      "Menu categories and variants",
      "Item photos and descriptions",
      "Permanent QR code",
      "Mobile-optimised menu view",
      "No customer registration",
      "Custom branding",
    ],
  },
  {
    name: "Online Ordering",
    price: "₹149",
    period: "per month",
    description: "Accept orders directly from tables. Real-time management included.",
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
    price: "₹299",
    period: "per month",
    description: "A complete kitchen and operations platform for growing restaurants.",
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
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="text-sm font-medium text-stone-600 hover:text-stone-900"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                Get started free
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold text-stone-900">Simple, transparent pricing</h1>
          <p className="mx-auto max-w-2xl text-xl text-stone-600">
            Start free. Upgrade only when you&apos;re ready for more. No hidden fees.
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
              <Link
                href={plan.ctaHref}
                className={`mb-8 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-colors ${
                  plan.primary
                    ? "text-brand-700 hover:bg-brand-50 bg-white"
                    : plan.soon
                      ? "cursor-not-allowed bg-stone-100 text-stone-400"
                      : "bg-brand-600 hover:bg-brand-700 text-white"
                }`}
              >
                {plan.cta}
              </Link>
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
