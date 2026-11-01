import Link from "next/link";
import { ArrowRight, BookOpenText, HeartHandshake, QrCode, ShieldCheck } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { marketingMetadata, safeJsonLd } from "@/lib/marketing/seo";
export const metadata = marketingMetadata({
  title: "About MenuMinute — Built for Food Businesses",
  description:
    "Meet MenuMinute, a restaurant QR menu and operations product from BabaBuilds, based in Pilani, Rajasthan, India.",
  pathname: "/about",
});
const commitments = [
  {
    title: "Start without a subscription",
    detail:
      "Create a restaurant QR menu on the free plan. Premium workflows have separate availability.",
    icon: QrCode,
  },
  {
    title: "Built for practical service",
    detail:
      "Make menus easier for guests to browse, with a clear path toward ordering and kitchen tools.",
    icon: HeartHandshake,
  },
  {
    title: "Clear feature boundaries",
    detail:
      "We distinguish free features from those requiring activation, eligibility or provider setup.",
    icon: ShieldCheck,
  },
];
export default function AboutPage() {
  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "BabaBuilds",
            url: "https://bababuilds.com",
            brand: { "@type": "Brand", name: "MenuMinute", url: "https://food.bababuilds.com" },
            address: {
              "@type": "PostalAddress",
              addressLocality: "Pilani",
              addressRegion: "Rajasthan",
              addressCountry: "IN",
            },
            contactPoint: {
              "@type": "ContactPoint",
              email: "admin@bababuilds.com",
              contactType: "customer support",
            },
          }),
        }}
      />
      <section className="border-border via-background border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10 px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="mb-5 text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">
            Our story / BabaBuilds
          </p>
          <h1 className="font-display max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Better restaurant tools.{" "}
            <span className="text-orange-600 dark:text-orange-400">A simpler starting point.</span>
          </h1>
          <p className="text-muted-foreground mt-7 max-w-2xl text-lg leading-8">
            MenuMinute is a product from BabaBuilds, based in Pilani, Rajasthan, India. We are
            building approachable software for restaurants, cafés, bakeries and other food
            businesses, starting with a free digital QR menu.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/free-qr-menu"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-700"
            >
              Explore free QR menus <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center rounded-xl border px-6 py-3 font-semibold"
            >
              Explore the demo
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <h2 className="font-display text-3xl font-bold">What guides our product</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {commitments.map(({ title, detail, icon: Icon }) => (
            <article key={title} className="border-border bg-card rounded-3xl border p-7 shadow-sm">
              <Icon className="mb-5 h-8 w-8 text-orange-600" aria-hidden="true" />
              <h3 className="text-xl font-bold">{title}</h3>
              <p className="text-muted-foreground mt-3 leading-7">{detail}</p>
            </article>
          ))}
        </div>
        <div className="border-border bg-muted/40 mt-12 rounded-3xl border p-7 sm:p-10">
          <div className="flex items-start gap-4">
            <BookOpenText className="mt-1 h-7 w-7 shrink-0 text-orange-600" aria-hidden="true" />
            <div>
              <h2 className="font-display text-2xl font-bold">
                More than a menu, without making big promises
              </h2>
              <p className="text-muted-foreground mt-3 max-w-3xl leading-7">
                MenuMinute also has ordering, point-of-sale and kitchen workflows. Availability and
                activation depend on the feature and outlet. Our{" "}
                <Link
                  href="/pricing"
                  className="font-semibold text-orange-700 underline dark:text-orange-300"
                >
                  pricing page
                </Link>{" "}
                explains these boundaries, while the{" "}
                <Link
                  href="/docs"
                  className="font-semibold text-orange-700 underline dark:text-orange-300"
                >
                  documentation
                </Link>{" "}
                shows the product.
              </p>
            </div>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
