import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  QrCode,
  Sparkles,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import type { MarketingFeature } from "@/content/marketing/features";
import { marketingFeatures } from "@/content/marketing/features";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { FeatureHeroArtwork } from "@/components/marketing/pages/feature-hero-artwork";
import { PUBLIC_ORIGIN, faqJsonLd, safeJsonLd } from "@/lib/marketing/seo";

const statusLabels = {
  free: "Free permanent QR menus",
  limited: "Requires outlet approval",
  provider: "Provider and approval required",
} as const;

export function FeatureLanding({ feature }: { feature: MarketingFeature }) {
  // Neighbouring features in catalogue order (wrapping), so related links differ per page.
  const index = marketingFeatures.findIndex((item) => item.slug === feature.slug);
  const related = [
    ...marketingFeatures.slice(index + 1),
    ...marketingFeatures.slice(0, index),
  ].slice(0, 3);
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: PUBLIC_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Features", item: PUBLIC_ORIGIN + "/features" },
      { "@type": "ListItem", position: 3, name: feature.title, item: PUBLIC_ORIGIN + feature.path },
    ],
  };
  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbs) }}
      />
      {feature.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd(feature.faqs)) }}
        />
      )}
      {feature.slug === "free-qr-menu" && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "MenuMinute Free QR Menu",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: feature.seoDescription,
              url: PUBLIC_ORIGIN + feature.path,
              provider: { "@type": "Organization", name: "BabaBuilds" },
              offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
            }),
          }}
        />
      )}
      <section className="border-border via-background relative isolate overflow-hidden border-b bg-gradient-to-br from-orange-500/10 to-amber-500/5">
        <div
          className="pointer-events-none absolute -top-48 -right-32 size-[38rem] rounded-full bg-orange-400/10 blur-3xl dark:bg-orange-700/10"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground mb-12 flex flex-wrap items-center gap-2 text-sm"
          >
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/features" className="hover:text-foreground">
              Features
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-foreground font-semibold" aria-current="page">
              {feature.title}
            </span>
          </nav>
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-2 text-xs font-bold tracking-widest text-orange-800 uppercase dark:text-orange-300">
                <Sparkles size={15} aria-hidden="true" /> {feature.eyebrow}
              </div>
              <h1 className="font-display max-w-2xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
                {feature.headline}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">
                {feature.description}
              </p>
              <div className="border-border bg-card/80 text-foreground mt-7 inline-flex max-w-xl items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold">
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full bg-orange-500"
                  aria-hidden="true"
                />
                {statusLabels[feature.availability]}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={feature.ctaHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/10 transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
                >
                  {feature.cta} <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link
                  href={feature.secondaryHref}
                  className="border-border bg-card text-foreground hover:bg-muted inline-flex min-h-12 items-center justify-center rounded-xl border px-6 py-3 text-sm font-bold transition"
                >
                  {feature.secondaryCta}
                </Link>
              </div>
              <p className="text-muted-foreground mt-5 max-w-xl text-sm leading-6">
                {feature.availabilityText}
              </p>
              {feature.availability !== "free" && (
                <a
                  href={
                    "mailto:admin@bababuilds.com?subject=" +
                    encodeURIComponent("MenuMinute " + feature.title + " availability enquiry")
                  }
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-700 underline underline-offset-4 hover:text-orange-600 dark:text-orange-300"
                >
                  Email us about {feature.title}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              )}
            </div>
            <div className="min-w-0">
              {feature.image ? (
                <figure className="border-border bg-card overflow-hidden rounded-[2rem] border shadow-2xl shadow-orange-950/10">
                  <div className="border-border bg-muted/50 flex items-center gap-2 border-b px-5 py-3">
                    <span className="size-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                    <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                    <span className="size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-muted-foreground ml-3 truncate text-xs font-semibold">
                      MenuMinute / {feature.title}
                    </span>
                  </div>
                  <Image
                    src={"/docs-media/" + feature.image + "-desktop-light.webp"}
                    alt={feature.imageAlt || feature.title}
                    width={1200}
                    height={800}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="block h-auto w-full dark:hidden"
                  />
                  <Image
                    src={"/docs-media/" + feature.image + "-desktop-dark.webp"}
                    alt=""
                    aria-hidden="true"
                    width={1200}
                    height={800}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="hidden h-auto w-full dark:block"
                  />
                  <figcaption className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs">
                    <span>{feature.screenshotCaption}</span>
                    <Link
                      href={feature.guideHref}
                      className="inline-flex min-h-9 items-center gap-1 font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
                    >
                      View the screen walkthrough
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </figcaption>
                </figure>
              ) : (
                <div
                  className="border-border relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-stone-900 to-stone-800 p-7 shadow-2xl sm:p-10"
                  aria-label="Illustration of an order and receipt workflow"
                >
                  <div
                    className="absolute top-0 right-0 size-64 rounded-full bg-orange-500/20 blur-3xl"
                    aria-hidden="true"
                  />
                  <div className="relative mx-auto max-w-md rounded-2xl border border-white/10 bg-white/10 p-6 text-white backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold">
                        <Store className="text-orange-300" aria-hidden="true" /> Counter record
                      </div>
                      <ClipboardList aria-hidden="true" />
                    </div>
                    <p className="mt-2 text-xs text-stone-300">
                      Illustrative workflow · not a live POS screen
                    </p>
                    <div className="mt-6 space-y-3 rounded-xl bg-white p-5 text-stone-900 shadow-lg">
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span>Order summary</span>
                        <QrCode size={18} aria-hidden="true" />
                      </div>
                      <div className="border-t border-dashed border-stone-300 pt-3 text-sm">
                        Menu items and quantities
                      </div>
                      <div className="border-t border-dashed border-stone-300 pt-3 text-sm">
                        Payment status: recorded by staff
                      </div>
                      <div className="flex items-center gap-2 pt-2 text-xs text-stone-500">
                        <UtensilsCrossed size={15} aria-hidden="true" /> Receipt and register
                        workflow
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <FeatureHeroArtwork feature={feature} />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
              Made for real service
            </p>
            <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              What it helps you do
            </h2>
            <p className="text-muted-foreground mt-4">
              Capabilities depend on the plan and outlet. Explore the benefits and check the
              availability note for this feature.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {feature.benefits.map((benefit, index) => (
              <article
                key={benefit.title}
                className="border-border bg-card rounded-3xl border p-6 shadow-sm sm:p-7"
              >
                <div className="font-display mb-5 inline-flex size-10 items-center justify-center rounded-xl bg-orange-500/10 text-lg font-bold text-orange-700 dark:text-orange-300">
                  {index + 1}
                </div>
                <h3 className="font-display text-xl font-bold">{benefit.title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-7">
                  {benefit.description}
                </p>
              </article>
            ))}
            <div className="rounded-3xl border border-orange-500/20 bg-orange-500/5 p-6 sm:p-7">
              <h3 className="font-display text-xl font-bold">At a glance</h3>
              <ul className="mt-4 space-y-3">
                {feature.highlights.map((highlight) => (
                  <li key={highlight} className="flex gap-2 text-sm leading-6 font-medium">
                    <Check className="mt-1 size-4 shrink-0 text-orange-600" aria-hidden="true" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
      <section className="border-border border-y bg-gradient-to-br from-stone-950 via-stone-900 to-[#442315] px-5 py-16 text-stone-50 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <article>
            <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">
              A practical restaurant story
            </p>
            <h2 className="font-display mt-4 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">
              {feature.editorial.title}
            </h2>
            <p className="mt-6 text-base leading-8 text-stone-200">{feature.editorial.situation}</p>
            <p className="mt-4 text-base leading-8 text-stone-200">{feature.editorial.approach}</p>
            <p className="mt-4 border-l-2 border-orange-400 pl-5 text-base leading-8 text-orange-100">
              {feature.editorial.outcome}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={feature.editorial.actionHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-orange-400"
              >
                {feature.editorial.actionLabel}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                href={feature.ctaHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-orange-100/35 px-5 py-3 text-sm font-bold text-white transition hover:border-orange-300"
              >
                {feature.cta}
              </Link>
            </div>
          </article>
          <aside className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm sm:p-8">
            <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">
              {feature.editorial.eyebrow}
            </p>
            <h3 className="font-display mt-4 text-xl font-bold">What to explore next</h3>
            <ul className="mt-6 space-y-5">
              {feature.editorial.checklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-7 text-stone-100">
                  <Check className="mt-1 size-5 shrink-0 text-orange-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={feature.guideHref}
              className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-200 underline underline-offset-4 hover:text-white"
            >
              {feature.guideLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
      <section className="border-border bg-muted/30 border-y px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            The workflow
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {feature.steps.map((step, index) => (
              <article key={step.title} className="border-border bg-card rounded-3xl border p-7">
                <span className="font-display text-3xl font-extrabold text-orange-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-display mt-5 text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-7">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            Helpful answers
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground mt-4 max-w-md">
            Need a deeper walkthrough?{" "}
            <Link
              href={feature.guideHref}
              className="font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
            >
              {feature.guideLabel}
            </Link>
            .
          </p>
        </div>
        <div className="space-y-3">
          {feature.faqs.map((faq) => (
            <details
              key={faq.question}
              className="group border-border bg-card rounded-2xl border p-6 open:shadow-sm"
            >
              <summary className="cursor-pointer leading-6 font-semibold marker:text-orange-600">
                {faq.question}
              </summary>
              <p className="text-muted-foreground mt-4 text-sm leading-7">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-24">
        <div className="rounded-[2rem] bg-stone-950 px-7 py-11 text-white sm:px-12 sm:py-14">
          <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">
            Your restaurant, your next step
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold sm:text-4xl">
            Explore the tools that fit your service.
          </h2>
          <p className="mt-4 max-w-2xl leading-7 text-stone-300">{feature.availabilityText}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={feature.ctaHref}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-500"
            >
              {feature.cta} <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-600 px-6 py-3 font-bold text-white hover:border-orange-300"
            >
              Compare plans <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href={feature.guideHref}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-600 px-6 py-3 font-bold text-white hover:border-orange-300"
            >
              Explore screenshots <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="mt-12">
          <h2 className="font-display text-2xl font-bold">Explore more MenuMinute features</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={item.path}
                className="group border-border bg-card flex items-center justify-between rounded-2xl border p-5 text-sm font-semibold transition hover:border-orange-500/40 hover:shadow-sm"
              >
                {item.title}
                <ArrowUpRight
                  className="size-4 text-orange-600 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
