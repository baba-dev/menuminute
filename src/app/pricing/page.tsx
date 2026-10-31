import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { CheckCircle, Sparkles, Terminal } from "lucide-react";
import { inrMonthlyPrice } from "@/modules/billing/catalog";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free permanent QR menus. AI import, ordering and Kitchen Pro require separate availability and operator approval.",
};

const plans = [
  {
    name: "Free Forever",
    price: "Free",
    period: "forever",
    description: "Everything needed to publish a beautiful, permanent restaurant QR menu.",
    cta: "Get started free",
    ctaHref: "/register",
    primary: false,
    badge: "Acquisition Favorite",
    availability:
      "AI photo extraction is optional and requires a supported, approved provider; it is not part of the always-on free QR menu.",
    features: [
      "Categories, dishes and descriptions",
      "Unlimited items and variants",
      "AI photo import where separately enabled and approved",
      "Permanent table QR codes",
      "Mobile-optimised instant menu view",
      "No customer registration required",
      "Live sold-out dish controls",
      "SVG/PNG QR downloads and browser Save as PDF printing",
    ],
  },
  {
    name: "Live Table Ordering",
    price: inrMonthlyPrice("ordering"),
    period: "/ month",
    altPrice: "INR billing · international pricing coming later",
    description:
      "Let diners order directly from their phone at the table. Eliminate waiter wait times and turn tables faster.",
    cta: "Create an account to check access",
    ctaHref: "/register",
    primary: true,
    badge: "Limited rollout",
    availability:
      "Ordering is feature-gated and available only to eligible, activated outlets. Registering does not immediately enable order intake.",
    features: [
      "Everything in Free Forever",
      "Table-based QR ordering & cart",
      "Dine-in and takeaway workflows",
      "Live Service Counter dashboard",
      "Real-time diner order tracking",
      "Kitchen receipt printing",
      "Order history and sales reports",
    ],
  },
  {
    name: "Kitchen Pro KDS",
    price: inrMonthlyPrice("kitchen_pro"),
    period: "/ month",
    altPrice: "Available after Kitchen Pro release approval",
    description:
      "Full digital Kitchen Display System replacing paper tickets with real-time station tablets and chimes.",
    cta: "Create an account for Kitchen Pro",
    ctaHref: "/register",
    primary: false,
    badge: "High Rush Kitchens",
    availability:
      "Kitchen Pro requires approved operator activation, staff assignment and readiness checks. This is not instant paid activation.",
    features: [
      "Everything in Live Ordering",
      "Live Kitchen Display System (KDS)",
      "Kitchen, bar, and expeditor routing",
      "Audible incoming ticket alerts",
      "Preparation timers and completion pass",
      "POS till and cash drawer shifts",
      "Kitchen device management",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Accessible Pricing · Zero Merchant Lock-In</span>
          </div>
          <h1 className="font-display text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, honest pricing.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl">
            Permanent QR menus are free. AI import and paid ordering or Kitchen Pro features become
            available only after the required provider, entitlement and rollout approvals.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between rounded-2xl p-8 transition-shadow ${
                plan.primary
                  ? "bg-brand-600 ring-brand-600 text-white shadow-xl ring-2 dark:bg-orange-600 dark:ring-orange-600"
                  : "border-border bg-card text-card-foreground border shadow-sm hover:shadow-md"
              }`}
            >
              {plan.badge && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold ${
                    plan.primary
                      ? "bg-stone-900 text-white dark:bg-stone-950"
                      : "border border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  {plan.badge}
                </div>
              )}

              <div>
                <h3
                  className={`mb-2 text-lg font-bold ${plan.primary ? "text-white" : "text-foreground"}`}
                >
                  {plan.name}
                </h3>
                <div className="mb-1 flex items-baseline">
                  <span
                    className={`text-4xl font-extrabold ${plan.primary ? "text-white" : "text-foreground"}`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`ml-1.5 text-sm ${plan.primary ? "text-orange-100" : "text-muted-foreground"}`}
                  >
                    {plan.period}
                  </span>
                </div>
                {plan.altPrice && (
                  <p
                    className={`mb-3 text-xs ${plan.primary ? "text-orange-200" : "text-muted-foreground"}`}
                  >
                    {plan.altPrice}
                  </p>
                )}
                <p
                  className={`mb-3 text-sm ${plan.primary ? "text-orange-100" : "text-muted-foreground"}`}
                >
                  {plan.description}
                </p>
                <p
                  className={`mb-6 text-xs leading-relaxed ${plan.primary ? "text-orange-100" : "text-muted-foreground"}`}
                >
                  {plan.availability}
                </p>

                <ul className="space-y-3 border-t border-stone-200/20 pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${plan.primary ? "text-orange-200" : "text-green-500"}`}
                      />
                      <span className={plan.primary ? "text-orange-100" : "text-muted-foreground"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href={plan.ctaHref}
                  className={`block w-full rounded-xl py-3 text-center text-sm font-semibold shadow-md transition-colors ${
                    plan.primary
                      ? "text-brand-700 bg-white hover:bg-stone-100 dark:bg-stone-900 dark:text-white dark:hover:bg-stone-800"
                      : "bg-brand-600 hover:bg-brand-700 text-white dark:bg-orange-600 dark:hover:bg-orange-500"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Open Source & Self-Hosted Banner */}
        <div className="mx-auto mt-16 max-w-5xl rounded-2xl border border-stone-200 bg-stone-50 p-6 sm:p-8 dark:border-stone-800 dark:bg-stone-900/60">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-stone-600 uppercase dark:text-stone-400">
                <Terminal className="h-4 w-4 text-orange-500" />
                <span>Open Source & Community Edition</span>
              </div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                Self-host MenuMinute on your own server.
              </h2>
              <p className="max-w-2xl text-sm text-stone-600 dark:text-stone-400">
                Prefer to run your own infrastructure? MenuMinute is open source under the MIT
                License. Community Edition is for single-user deployments. Ordering and KDS remain
                subject to runtime and safety gates; AI requires configured provider credentials and
                appropriate commercial rights.
              </p>
            </div>
            <a
              href="https://github.com/baba-dev/menuminute"
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <span>View on GitHub</span>
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
