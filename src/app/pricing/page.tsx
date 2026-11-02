import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { CheckCircle, Sparkles, Terminal } from "lucide-react";
import { planLadder, type PlanOffer } from "@/modules/plans/offer";
import type { BillingCurrency } from "@/modules/billing/catalog";
import { PLAN_LIMITS, type PlanKey } from "@/modules/plans/catalog";
import { fmt } from "@/modules/plans/view";

export const metadata: Metadata = {
  alternates: { canonical: "/pricing" },
  title: "Pricing",
  description:
    "Free permanent QR menus. Ordering from ₹119 a month, Kitchen Pro at a flat ₹499 a month for up to ten outlets, and Dedicated at ₹30,000 a month.",
};

/** Everything below comes from the reviewed plan catalogs, the same ones checkout uses. */
const CARD: Record<
  PlanKey,
  { badge?: string; cta: string; href: string; primary: boolean; blurb: string }
> = {
  free: {
    cta: "Get started free",
    href: "/register",
    primary: false,
    blurb: "Everything needed to publish a beautiful, permanent restaurant QR menu.",
  },
  ordering: {
    badge: "Most popular",
    cta: "Get Ordering",
    href: "/register",
    primary: true,
    blurb:
      "Let diners order from their phone at the table. Take dine-in and pickup orders, with the counter board and order tracking.",
  },
  kitchen_pro: {
    badge: "For busy kitchens",
    cta: "Get Kitchen Pro",
    href: "/register",
    primary: false,
    blurb:
      "Everything in Ordering, plus a kitchen display with station routing, and room for up to ten outlets.",
  },
  dedicated: {
    cta: "Talk to us about Dedicated",
    href: "/contact",
    primary: false,
    blurb: "Your own branded app on your own domain, set up with our team. Built around you.",
  },
};

const limit = (n: number | null) => (n === null ? "Virtually unlimited" : fmt(n));
const floor = (plan: PlanKey) => {
  const { tables, chairs } = PLAN_LIMITS[plan];
  return tables === null || chairs === null
    ? "Virtually unlimited"
    : `${fmt(tables)} tables · ${fmt(chairs)} chairs`;
};

/** The comparison table: one row per limit, one column per plan. */
const ROWS: { label: string; cell: (plan: PlanKey) => string }[] = [
  {
    label: "Outlets",
    cell: (p) =>
      p === "kitchen_pro"
        ? `Up to ${fmt(PLAN_LIMITS.kitchen_pro.outlets ?? 10)}`
        : limit(PLAN_LIMITS[p].outlets),
  },
  { label: "Dishes per outlet", cell: (p) => limit(PLAN_LIMITS[p].dishes) },
  { label: "QR codes", cell: (p) => limit(PLAN_LIMITS[p].qrCodes) },
  { label: "Dining floor", cell: floor },
  {
    label: "Online ordering",
    cell: (p) =>
      p === "free"
        ? `Up to ${fmt(PLAN_LIMITS.free.ordersPerMonth ?? 0)} orders a month`
        : "Included, no monthly cap",
  },
  {
    label: "Kitchen display and stations",
    cell: (p) => (p === "free" || p === "ordering" ? "—" : "Included"),
  },
  {
    label: "Your own domain and branding",
    cell: (p) => (p === "dedicated" ? "Set up with our team" : "—"),
  },
];

function PlanCard({ offer, currency }: { offer: PlanOffer; currency: BillingCurrency }) {
  const card = CARD[offer.key];
  const usdInterest = currency === "USD" && (offer.key === "ordering" || offer.key === "kitchen_pro");
  const actionHref = usdInterest ? "/contact" : card.href;
  const actionText = usdInterest ? "Ask about USD billing" : card.cta;
  const primary = card.primary;
  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl p-7 transition-shadow ${
        primary
          ? "bg-brand-600 ring-brand-600 text-white shadow-xl ring-2 dark:bg-orange-600 dark:ring-orange-600"
          : "border-border bg-card text-card-foreground border shadow-sm hover:shadow-md"
      }`}
    >
      {card.badge && (
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
            primary
              ? "bg-stone-900 text-white dark:bg-stone-950"
              : "border border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
          }`}
        >
          {card.badge}
        </div>
      )}
      <div>
        <h3 className={`mb-2 text-lg font-bold ${primary ? "text-white" : "text-foreground"}`}>
          {offer.label}
        </h3>
        <div className="mb-1 flex items-baseline">
          <span className={`text-4xl font-extrabold ${primary ? "text-white" : "text-foreground"}`}>
            {offer.price.label}
          </span>
          <span
            className={`ml-1.5 text-sm ${primary ? "text-orange-100" : "text-muted-foreground"}`}
          >
            {offer.price.note === "per month" ? "/ month" : offer.price.note}
          </span>
        </div>
        <p
          className={`mb-3 min-h-8 text-xs font-semibold ${primary ? "text-orange-100" : "text-orange-700 dark:text-orange-300"}`}
        >
          {offer.price.detail ?? ""}
        </p>
        <p
          className={`mb-6 text-sm leading-relaxed ${primary ? "text-orange-100" : "text-muted-foreground"}`}
        >
          {card.blurb}
        </p>
        <ul className="space-y-3 border-t border-stone-200/20 pt-6">
          {offer.highlights.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm">
              <CheckCircle
                className={`mt-0.5 h-4 w-4 shrink-0 ${primary ? "text-orange-200" : "text-green-500"}`}
                aria-hidden="true"
              />
              <span className={primary ? "text-orange-100" : "text-muted-foreground"}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 pt-4">
        <Link
          href={actionHref}
          className={`block w-full rounded-xl py-3 text-center text-sm font-semibold shadow-md transition-colors ${
            primary
              ? "text-brand-700 bg-white hover:bg-stone-100 dark:bg-stone-900 dark:text-white dark:hover:bg-stone-800"
              : "bg-brand-600 hover:bg-brand-700 text-white dark:bg-orange-600 dark:hover:bg-orange-500"
          }`}
        >
          {actionText}
        </Link>
      </div>
    </div>
  );
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ currency?: string | string[] }>;
}) {
  const query = await searchParams;
  const currency: BillingCurrency = query.currency === "USD" ? "USD" : "INR";
  const plans = planLadder({ currency });
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
            Your permanent QR menu is free. Add ordering when you want guests to order from the
            table, and a full kitchen display when your service needs it. Compare fixed INR and USD
            monthly prices below; restaurant menu prices remain independent of platform billing.
          </p>
          <nav aria-label="Subscription pricing currency" className="mt-7 flex justify-center gap-2">
            {(["INR", "USD"] as const).map((code) => (
              <Link
                key={code}
                href={`/pricing?currency=${code}`}
                aria-current={currency === code ? "page" : undefined}
                className={`rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
                  currency === code
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-border bg-card text-foreground hover:border-orange-500"
                }`}
              >
                {code === "INR" ? "₹ INR" : "$ USD"}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((offer) => (
            <PlanCard key={offer.key} offer={offer} currency={currency} />
          ))}
        </div>

        <p className="text-muted-foreground mx-auto mt-8 max-w-3xl text-center text-sm">
          Already a customer?{" "}
          <Link href="/billing" className="text-foreground font-semibold underline">
            Manage your plan in billing
          </Link>
          . {currency === "USD"
            ? "USD plans are published for international enquiries. USD checkout is not yet active; no USD card charges can be initiated from this page."
            : "Current self-service checkout charges in INR. USD plan requests are available in the USD tab."}
        </p>

        <section className="mx-auto mt-20 max-w-6xl" aria-labelledby="compare-heading">
          <h2 id="compare-heading" className="font-display mb-6 text-2xl font-bold tracking-tight">
            Compare the plans
          </h2>
          <div className="border-border overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <caption className="sr-only">Limits and features of each MenuMinute plan</caption>
              <thead className="bg-muted/60">
                <tr>
                  <th scope="col" className="px-5 py-4 font-semibold">
                    <span className="sr-only">Feature</span>
                  </th>
                  {plans.map((offer) => (
                    <th key={offer.key} scope="col" className="px-5 py-4 font-bold">
                      {offer.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                <tr>
                  <th scope="row" className="text-muted-foreground px-5 py-3.5 font-medium">
                    Price per month
                  </th>
                  {plans.map((offer) => (
                    <td key={offer.key} className="px-5 py-3.5 font-semibold">
                      {offer.price.label}
                    </td>
                  ))}
                </tr>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="text-muted-foreground px-5 py-3.5 font-medium">
                      {row.label}
                    </th>
                    {plans.map((offer) => (
                      <td key={offer.key} className="px-5 py-3.5">
                        {row.cell(offer.key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted-foreground mt-4 text-sm">
            Kitchen Pro is one flat price for up to ten outlets. Limits apply per organization and
            outlet as shown. Your printed QR links keep working on every plan, including after a
            downgrade.
          </p>
        </section>

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
                License. Community Edition is for single-user deployments, with ordering and kitchen
                features available without a subscription. AI features need your own provider
                credentials and appropriate commercial rights.
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
