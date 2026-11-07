import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Sparkles } from "lucide-react";
import { marketingFeatures } from "@/content/marketing/features";
import { featureFaqs, featureSpotlights } from "@/content/marketing/features-overview";
import { industrySolutions } from "@/content/marketing/solutions";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { faqJsonLd, marketingMetadata, PUBLIC_ORIGIN, safeJsonLd } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Restaurant Management Features: QR Menus, Ordering, POS & More",
  description:
    "Explore MenuMinute restaurant features: free QR menus, menu builder, online ordering, Kitchen Pro, POS, tables, guest CRM, reports and AI tools. See real app screenshots.",
  pathname: "/features",
  image: "/docs-media/dashboard-desktop-light.webp",
  imageAlt: "Actual MenuMinute restaurant management dashboard",
});

const serviceJourney = [
  {
    number: "01",
    title: "Build and publish",
    description:
      "Organize dishes, choose prices and options, then publish a mobile-friendly menu that guests can open from a permanent QR code.",
    href: "/docs/menu-studio",
    link: "Build a menu",
  },
  {
    number: "02",
    title: "Let guests explore",
    description:
      "Share the menu on tables or online. Guests browse dishes and, when ordering is enabled, send dine-in or pickup requests.",
    href: "/docs/public-menu",
    link: "See the guest view",
  },
  {
    number: "03",
    title: "Run the service",
    description:
      "Staff accept requests and manage tickets. Eligible outlets can coordinate table service and route accepted items to kitchen stations.",
    href: "/docs/orders",
    link: "See order workflows",
  },
  {
    number: "04",
    title: "Learn and improve",
    description:
      "Review recorded activity in Reports and use permissions-aware tools to understand the day and prepare for the next service.",
    href: "/docs/reports",
    link: "Explore insights",
  },
] as const;

const moreCapabilities = [
  {
    title: "Guest CRM and repeat visits",
    text: "For eligible paid outlets, guest records can help staff recognize returning customers by mobile number in supported POS workflows. Keep useful visit context separate from the busy order-entry screen.",
    href: "/pricing",
    action: "Check plan availability",
  },
  {
    title: "POS, receipts and shift closing",
    text: "The cashier workspace supports counter order entry, staff-recorded tenders, receipts and register closing. These are operational records, not a claim that online payments have been captured.",
    href: "/features/restaurant-pos",
    action: "Explore point of sale",
  },
  {
    title: "Outlet details, taxes and currency",
    text: "Set up useful outlet information, opening hours, supported currencies and applicable tax configuration for supported flows. Tax compliance and statutory invoicing still require the merchant's own review.",
    href: "/docs/settings",
    action: "Explore outlet settings",
  },
  {
    title: "Dine-in and pickup workflows",
    text: "Use an ordering journey built around how the food will reach the guest. Dine-in and pickup tickets keep their own service stages; availability and scheduled pickup require the relevant setup.",
    href: "/ordering",
    action: "Explore online ordering",
  },
] as const;

export default function FeaturesPage() {
  const featureList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "MenuMinute restaurant features",
    itemListElement: marketingFeatures.map((feature, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: feature.title,
      url: PUBLIC_ORIGIN + feature.path,
    })),
  };

  return (
    <MarketingPageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(featureList) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd(featureFaqs)) }}
      />

      <section className="border-border via-background relative isolate overflow-hidden border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10">
        <div
          className="pointer-events-none absolute -top-40 -right-32 size-[34rem] rounded-full bg-orange-500/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-6 sm:pb-20 lg:px-8">
          <nav
            aria-label="Breadcrumb"
            className="text-muted-foreground flex items-center gap-2 text-sm"
          >
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page" className="text-foreground font-semibold">
              Features
            </span>
          </nav>
          <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-16">
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">
                Explore every MenuMinute feature
              </p>
              <h1 className="font-display mt-5 max-w-3xl text-4xl leading-[1.12] font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
                Your menu. Your service.{" "}
                <span className="text-orange-600 dark:text-orange-400">All under one roof.</span>
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">
                Start with a genuinely free restaurant QR menu, then explore connected online
                ordering, kitchen displays, point of sale, guest service and reporting. MenuMinute
                brings the work of running a food business into one thoughtful workspace.
              </p>
              <p className="text-muted-foreground mt-4 max-w-xl leading-7">
                Below you will find real screenshots, practical examples, helpful guides and clear
                notes about which tools need a paid plan or additional setup.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/10 transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
                >
                  Create your free QR menu <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <Link
                  href="/demo"
                  className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold transition"
                >
                  Explore the live demo <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <ul className="text-muted-foreground mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
                {[
                  "No app download for diners",
                  "Permanent menu QR codes",
                  "Free core menu publishing",
                ].map((value) => (
                  <li key={value} className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-orange-600" aria-hidden="true" />
                    {value}
                  </li>
                ))}
              </ul>
            </div>
            <figure className="border-border bg-card min-w-0 overflow-hidden rounded-[2rem] border shadow-2xl shadow-orange-950/10">
              <div className="border-border bg-muted/50 flex items-center gap-2 border-b px-5 py-3">
                <span className="size-2.5 rounded-full bg-rose-400" aria-hidden="true" />
                <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
                <span className="size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className="text-muted-foreground ml-3 truncate text-xs font-semibold">
                  MenuMinute / Restaurant Dashboard
                </span>
              </div>
              <Image
                src="/docs-media/dashboard-desktop-light.webp"
                alt="Actual MenuMinute restaurant dashboard with current menu status and operational panels"
                width={1200}
                height={750}
                sizes="(max-width: 1024px) 100vw, 46vw"
                priority
                className="h-auto w-full dark:hidden"
              />
              <Image
                src="/docs-media/dashboard-desktop-dark.webp"
                alt=""
                aria-hidden="true"
                width={1200}
                height={750}
                sizes="(max-width: 1024px) 100vw, 46vw"
                className="hidden h-auto w-full dark:block"
              />
              <figcaption className="border-border text-muted-foreground border-t px-5 py-3 text-xs leading-5">
                Actual MenuMinute interface · Sample restaurant dashboard, shown in light and dark
                mode
              </figcaption>
            </figure>
          </div>
          <nav aria-label="On this page" className="mt-12 flex flex-wrap gap-3">
            <a
              href="#all-features"
              className="border-border bg-card/70 inline-flex min-h-10 items-center rounded-full border px-5 py-2 text-sm font-semibold transition hover:border-orange-500/40"
            >
              Core features
            </a>
            <a
              href="#how-it-works"
              className="border-border bg-card/70 inline-flex min-h-10 items-center rounded-full border px-5 py-2 text-sm font-semibold transition hover:border-orange-500/40"
            >
              How it connects
            </a>
            <a
              href="#more-features"
              className="border-border bg-card/70 inline-flex min-h-10 items-center rounded-full border px-5 py-2 text-sm font-semibold transition hover:border-orange-500/40"
            >
              More to explore
            </a>
            <a
              href="#frequently-asked-questions"
              className="border-border bg-card/70 inline-flex min-h-10 items-center rounded-full border px-5 py-2 text-sm font-semibold transition hover:border-orange-500/40"
            >
              Questions and answers
            </a>
          </nav>
        </div>
      </section>

      <section
        id="all-features"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="mb-9 max-w-3xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            Explore the core toolkit
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            The essentials of a better restaurant workflow.
          </h2>
          <p className="text-muted-foreground mt-4 leading-8">
            Every business starts differently. Some need a polished digital menu today. Others want
            to connect dine-in orders, cashier work and kitchen preparation. Explore each feature in
            detail and choose what makes sense for your outlet.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {marketingFeatures.map((feature) => (
            <article
              key={feature.slug}
              className="border-border bg-card flex min-w-0 flex-col overflow-hidden rounded-3xl border shadow-sm transition hover:border-orange-500/30 hover:shadow-lg"
            >
              <div className="flex aspect-[8/5] items-center justify-center overflow-hidden bg-gradient-to-br from-orange-500/10 to-stone-500/10">
                {feature.image ? (
                  <>
                    <Image
                      src={"/docs-media/" + feature.image + "-desktop-light.webp"}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt={feature.imageAlt || feature.title}
                      className="h-full w-full object-contain object-center dark:hidden"
                    />
                    <Image
                      src={"/docs-media/" + feature.image + "-desktop-dark.webp"}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt=""
                      aria-hidden="true"
                      className="hidden h-full w-full object-contain object-center dark:block"
                    />
                  </>
                ) : (
                  <>
                    <Image
                      src={feature.heroArtwork.desktopLight}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt={feature.heroArtwork.alt}
                      className="h-full w-full object-cover object-center dark:hidden"
                    />
                    <Image
                      src={feature.heroArtwork.desktopDark}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      alt=""
                      aria-hidden="true"
                      className="hidden h-full w-full object-cover object-center dark:block"
                    />
                  </>
                )}
              </div>
              <div className="flex flex-1 flex-col p-7">
                <span className="text-xs font-bold tracking-wider text-orange-700 uppercase dark:text-orange-300">
                  {feature.availability === "free"
                    ? "Free core features"
                    : feature.availability === "paid"
                      ? "Plan-dependent access"
                      : feature.availability === "limited"
                        ? "Limited access"
                        : "Provider-gated"}
                </span>
                <h3 className="font-display mt-3 text-2xl font-bold">{feature.title}</h3>
                <p className="text-muted-foreground mt-3 flex-1 text-sm leading-7">
                  {feature.description}
                </p>
                <Link
                  href={feature.path}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-orange-700 hover:underline dark:text-orange-300"
                >
                  Explore {feature.title.toLowerCase()}{" "}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
        <p className="text-muted-foreground mt-7 text-sm leading-7">
          Feature availability varies by plan, outlet configuration, provider readiness and
          permissions.{" "}
          <Link
            href="/pricing"
            className="font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
          >
            Review the current plans and availability
          </Link>{" "}
          before upgrading.
        </p>
      </section>

      <section
        id="how-it-works"
        className="border-border scroll-mt-24 border-y bg-gradient-to-br from-stone-950 via-stone-900 to-[#442315] px-5 py-16 text-stone-50 sm:py-24"
      >
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">
            One connected journey
          </p>
          <h2 className="font-display mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            From a guest discovering a dish to your next day&apos;s decisions.
          </h2>
          <p className="mt-5 max-w-3xl leading-8 text-stone-300">
            A restaurant runs on handoffs. MenuMinute gives each part of the experience its own
            workspace while keeping the journey connected. Start small and expand only when your
            restaurant needs more.
          </p>
          <ol className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {serviceJourney.map((step) => (
              <li
                key={step.number}
                className="flex flex-col rounded-3xl border border-white/15 bg-white/5 p-6 sm:p-7"
              >
                <span className="font-display text-3xl font-extrabold text-orange-300">
                  {step.number}
                </span>
                <h3 className="font-display mt-5 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-stone-300">{step.description}</p>
                <Link
                  href={step.href}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-200 underline underline-offset-4 hover:text-white"
                >
                  {step.link} <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="more-features"
        className="mx-auto max-w-7xl scroll-mt-24 px-5 py-16 sm:px-6 sm:py-24 lg:px-8"
      >
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            Go deeper into MenuMinute
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            The thoughtful details that make a busy day easier.
          </h2>
          <p className="text-muted-foreground mt-5 leading-8">
            These are real areas of the product, not concept screens. Browse the screenshots and
            explanations to see what each tool does, why it matters and when you might use it.
          </p>
        </div>
        <div className="mt-12 space-y-8 sm:space-y-12">
          {featureSpotlights.map((feature, index) => (
            <article
              key={feature.id}
              id={feature.id}
              className="border-border bg-card grid scroll-mt-24 items-center gap-8 overflow-hidden rounded-[2rem] border p-6 shadow-sm sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10"
            >
              <div className={index % 2 === 1 ? "min-w-0 lg:order-2" : "min-w-0"}>
                <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
                  {feature.eyebrow}
                </p>
                <h3 className="font-display mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {feature.title}
                </h3>
                <p className="mt-4 text-lg leading-8 font-semibold">{feature.lead}</p>
                {feature.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-muted-foreground mt-4 text-sm leading-7 sm:text-base sm:leading-8"
                  >
                    {paragraph}
                  </p>
                ))}
                <ul className="mt-6 space-y-3">
                  {feature.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-start gap-3 text-sm leading-6 font-semibold"
                    >
                      <Check className="mt-1 size-4 shrink-0 text-orange-600" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
                <p className="border-border text-muted-foreground mt-6 border-l-2 border-orange-500/40 pl-4 text-xs leading-6">
                  {feature.availabilityNote}
                </p>
                <Link
                  href={feature.guideHref}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-orange-700 underline underline-offset-4 dark:text-orange-300"
                >
                  {feature.guideLabel} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <figure
                className={
                  index % 2 === 1
                    ? "border-border bg-muted/30 min-w-0 overflow-hidden rounded-3xl border lg:order-1"
                    : "border-border bg-muted/30 min-w-0 overflow-hidden rounded-3xl border"
                }
              >
                <div className="border-border flex items-center gap-2 border-b px-4 py-3">
                  <span className="size-2 rounded-full bg-rose-400" aria-hidden="true" />
                  <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
                  <span className="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
                  <span className="text-muted-foreground ml-2 truncate text-xs font-medium">
                    Actual MenuMinute interface
                  </span>
                </div>
                <Image
                  src={"/docs-media/" + feature.shot + "-desktop-light.webp"}
                  alt={feature.alt}
                  width={1200}
                  height={750}
                  sizes="(max-width: 1024px) 100vw, 44vw"
                  className="h-auto w-full dark:hidden"
                />
                <Image
                  src={"/docs-media/" + feature.shot + "-desktop-dark.webp"}
                  alt=""
                  aria-hidden="true"
                  width={1200}
                  height={750}
                  sizes="(max-width: 1024px) 100vw, 44vw"
                  className="hidden h-auto w-full dark:block"
                />
                <figcaption className="border-border text-muted-foreground border-t px-4 py-3 text-xs leading-6">
                  {feature.caption}
                </figcaption>
              </figure>
            </article>
          ))}
        </div>
      </section>

      <section className="border-border bg-muted/30 border-y px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            More helpful restaurant tools
          </p>
          <h2 className="font-display mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            A little less manual work, from the counter to the back office.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-3xl leading-8">
            MenuMinute also includes workflows for the everyday details around food service. Some
            are plan-dependent or disabled in the shared demo, so check availability before relying
            on them for your business.
          </p>
          <div className="mt-9 grid gap-5 md:grid-cols-2">
            {moreCapabilities.map((item) => (
              <article
                key={item.title}
                className="border-border bg-card flex flex-col rounded-3xl border p-7 shadow-sm"
              >
                <h3 className="font-display text-xl font-bold">{item.title}</h3>
                <p className="text-muted-foreground mt-3 flex-1 text-sm leading-7">{item.text}</p>
                <Link
                  href={item.href}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-700 underline underline-offset-4 dark:text-orange-300"
                >
                  {item.action} <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
          Solutions by industry
        </p>
        <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Made for the way you serve food.
        </h2>
        <p className="text-muted-foreground mt-4 max-w-3xl leading-8">
          A restaurant table, coffee counter, bakery display and pickup kitchen all have different
          needs. See realistic workflows for each kind of business, with product screenshots and
          practical starting points.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {industrySolutions.map((solution) => (
            <Link
              key={solution.slug}
              href={"/solutions/" + solution.slug}
              className="border-border bg-card group flex min-h-20 items-center justify-between gap-3 rounded-2xl border p-5 font-bold transition hover:border-orange-500/40 hover:shadow-sm"
            >
              {solution.title}
              <ArrowUpRight size={17} className="shrink-0 text-orange-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
        <Link
          href="/solutions"
          className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
        >
          Compare all food business solutions <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </section>

      <section
        id="frequently-asked-questions"
        className="border-border bg-muted/20 scroll-mt-24 border-t px-5 py-16 sm:py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <div>
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600">
              <CircleHelp size={24} aria-hidden="true" />
            </div>
            <p className="mt-5 text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
              Practical answers
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Frequently asked questions about MenuMinute.
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md leading-8">
              Straight answers about free QR menus, order acceptance, payment, AI and what you can
              try in the demo. For step-by-step help, explore the{" "}
              <Link
                href="/docs"
                className="font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
              >
                product guides
              </Link>
              .
            </p>
          </div>
          <div className="space-y-3">
            {featureFaqs.map((faq) => (
              <details
                key={faq.question}
                className="group border-border bg-card rounded-2xl border p-5 open:shadow-sm sm:p-6"
              >
                <summary className="cursor-pointer text-base leading-7 font-semibold marker:text-orange-600">
                  {faq.question}
                </summary>
                <p className="text-muted-foreground mt-4 text-sm leading-7">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="rounded-[2rem] bg-stone-950 px-7 py-11 text-white sm:px-12 sm:py-14">
          <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-orange-300 uppercase">
            <Sparkles size={16} aria-hidden="true" /> Ready when you are
          </div>
          <h2 className="font-display mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            Start with a beautiful menu. Grow into the tools you need.
          </h2>
          <p className="mt-5 max-w-3xl leading-8 text-stone-300">
            Publish your first QR menu free, see the real application in the interactive demo and
            choose additional ordering, service or kitchen tools when your restaurant is ready. No
            diner download required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-500"
            >
              Create a free menu <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-600 px-6 py-3 text-sm font-bold text-white transition hover:border-orange-300"
            >
              Explore the demo <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-600 px-6 py-3 text-sm font-bold text-white transition hover:border-orange-300"
            >
              Compare plans <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingPageShell>
  );
}
