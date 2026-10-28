import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { CheckCircle } from "lucide-react";

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
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />

      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h1 className="font-display text-foreground mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg sm:text-xl">
            Free QR menus are available now. Ordering and Kitchen Pro pricing and subscription terms
            are not finalized.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 transition-shadow ${
                plan.primary
                  ? "bg-brand-600 ring-brand-600 text-white shadow-xl ring-2"
                  : "border-border bg-card text-card-foreground border shadow-sm hover:shadow-md"
              }`}
            >
              {plan.soon && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-800 px-3 py-1 text-xs font-semibold text-white dark:bg-stone-700">
                  Coming soon
                </div>
              )}
              <h3
                className={`mb-2 text-lg font-bold ${plan.primary ? "text-white" : "text-foreground"}`}
              >
                {plan.name}
              </h3>
              <div className="mb-4">
                <span
                  className={`text-4xl font-bold ${plan.primary ? "text-white" : "text-foreground"}`}
                >
                  {plan.price}
                </span>
                <span
                  className={`ml-1 text-sm ${plan.primary ? "text-brand-100" : "text-muted-foreground"}`}
                >
                  {plan.period}
                </span>
              </div>
              <p
                className={`mb-6 text-sm ${plan.primary ? "text-brand-100" : "text-muted-foreground"}`}
              >
                {plan.description}
              </p>
              {plan.soon ? (
                <span
                  aria-disabled="true"
                  className="bg-muted text-muted-foreground mb-8 block w-full cursor-not-allowed rounded-xl py-3 text-center text-sm font-semibold"
                >
                  Coming soon · pricing pending
                </span>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="bg-brand-600 hover:bg-brand-700 mb-8 block w-full rounded-xl py-3 text-center text-sm font-semibold text-white shadow-md transition-colors"
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
                    <span className={plan.primary ? "text-brand-100" : "text-muted-foreground"}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
