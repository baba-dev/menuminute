import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, ClipboardCheck, Sparkles } from "lucide-react";
import type { IndustrySolution } from "@/content/marketing/solutions";
import { industrySolutions } from "@/content/marketing/solutions";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { PUBLIC_ORIGIN, safeJsonLd } from "@/lib/marketing/seo";

function ProductScreenshot({
  shot,
  alt,
  caption,
}: {
  shot: string;
  alt: string;
  caption: string;
}) {
  return (
    <figure className="border-border bg-card overflow-hidden rounded-3xl border shadow-lg shadow-stone-950/5">
      <div className="border-border bg-muted/50 flex items-center gap-2 border-b px-5 py-3">
        <span className="size-2.5 rounded-full bg-rose-400" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-amber-400" aria-hidden="true" />
        <span className="size-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="text-muted-foreground ml-2 text-xs font-semibold">MenuMinute · product walkthrough</span>
      </div>
      <Image
        src={"/docs-media/" + shot + "-desktop-light.webp"}
        width={1200}
        height={750}
        sizes="(max-width: 1024px) 100vw, 50vw"
        alt={alt}
        className="block h-auto w-full dark:hidden"
      />
      <Image
        src={"/docs-media/" + shot + "-desktop-dark.webp"}
        width={1200}
        height={750}
        sizes="(max-width: 1024px) 100vw, 50vw"
        alt=""
        aria-hidden="true"
        className="hidden h-auto w-full dark:block"
      />
      <figcaption className="border-border text-muted-foreground border-t px-5 py-3 text-xs">
        {caption} · Actual MenuMinute interface from the public documentation
      </figcaption>
    </figure>
  );
}

function IndustryArtwork({ solution }: { solution: IndustrySolution }) {
  return (
    <figure className="border-border bg-muted relative overflow-hidden rounded-[2rem] border shadow-lg">
      <div className="relative hidden h-[240px] sm:block lg:h-[360px]">
        <Image
          src={solution.artBase + "/hero-desktop-light.webp"}
          alt={solution.artCaption}
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover object-center dark:hidden"
        />
        <Image
          src={solution.artBase + "/hero-desktop-dark.webp"}
          alt=""
          aria-hidden="true"
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="hidden object-cover object-center dark:block"
        />
      </div>
      <div className="relative h-[320px] sm:hidden">
        <Image
          src={solution.artBase + "/hero-mobile-light.webp"}
          alt={solution.artCaption}
          fill
          sizes="100vw"
          className="object-cover object-center dark:hidden"
        />
        <Image
          src={solution.artBase + "/hero-mobile-dark.webp"}
          alt=""
          aria-hidden="true"
          fill
          sizes="100vw"
          className="hidden object-cover object-center dark:block"
        />
      </div>
      <figcaption className="border-border bg-card text-muted-foreground border-t px-5 py-3 text-xs">
        {solution.artCaption}
      </figcaption>
    </figure>
  );
}

export function IndustrySolutionPage({ solution }: { solution: IndustrySolution }) {
  const related = industrySolutions.filter((other) => other.slug !== solution.slug);
  const crumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: PUBLIC_ORIGIN },
      { "@type": "ListItem", position: 2, name: "Solutions", item: PUBLIC_ORIGIN + "/solutions" },
      { "@type": "ListItem", position: 3, name: solution.title, item: PUBLIC_ORIGIN + "/solutions/" + solution.slug },
    ],
  };

  return (
    <MarketingPageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }} />
      <section className="border-border via-background relative overflow-hidden border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10">
        <div className="mx-auto max-w-7xl px-5 pt-8 pb-16 sm:px-6 sm:pb-24 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-muted-foreground mb-12 flex flex-wrap items-center gap-2 text-sm">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <Link href="/solutions" className="hover:text-foreground">Solutions</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span className="text-foreground font-semibold" aria-current="page">{solution.title}</span>
          </nav>
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-4 py-2 text-xs font-bold tracking-widest text-orange-800 uppercase dark:text-orange-300">
                <Sparkles size={15} aria-hidden="true" /> {solution.eyebrow}
              </span>
              <h1 className="font-display mt-6 max-w-xl text-4xl leading-[1.1] font-extrabold tracking-tight sm:text-5xl xl:text-6xl">
                {solution.headline}
              </h1>
              <p className="text-muted-foreground mt-6 max-w-xl text-lg leading-8">{solution.intro}</p>
              <p className="text-muted-foreground mt-5 flex gap-2 text-sm leading-6">
                <Check className="mt-1 size-4 shrink-0 text-orange-600" aria-hidden="true" />
                Start with MenuMinute's free QR menu. Advanced service features are activated separately.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-orange-700">
                  Create my free menu <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link href="/demo" className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold">
                  Explore live demo <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <figure className="border-border bg-card relative overflow-hidden rounded-[2rem] border shadow-2xl shadow-stone-950/10">
              <div className="relative aspect-[5/4] w-full">
                <Image
                  src={solution.cover}
                  alt={solution.coverAlt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/80 to-transparent px-6 pt-16 pb-6 text-white">
                  <span className="text-xs font-bold tracking-widest uppercase">Designed for your kind of service</span>
                  <p className="font-display mt-2 text-2xl font-bold">{solution.audience}</p>
                </div>
              </div>
              <figcaption className="text-muted-foreground px-5 py-3 text-xs">Illustrative food photography from MenuMinute's bundled public menu artwork</figcaption>
            </figure>
          </div>
          <div className="mt-12">
            <IndustryArtwork solution={solution} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid gap-9 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">The working day</p>
            <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{solution.scenario.title}</h2>
            <p className="text-muted-foreground mt-5 leading-8">{solution.scenario.intro}</p>
            <p className="text-muted-foreground mt-3 text-sm">This is an illustrative scenario, not a customer testimonial or measured result.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {solution.scenario.stages.map((stage, index) => (
              <li key={stage.title} className="border-border bg-card rounded-3xl border p-6 shadow-sm">
                <span className="font-display text-3xl font-extrabold text-orange-600">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-muted-foreground mt-5 text-xs font-bold tracking-wider uppercase">{stage.time}</p>
                <h3 className="font-display mt-2 text-xl font-bold">{stage.title}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-7">{stage.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-border bg-muted/30 border-y px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">Inside the product</p>
          <h2 className="font-display mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
            See the tools, not just the promises.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl leading-8">These screenshots come from the actual MenuMinute demonstration and documentation. The sample restaurant is illustrative; the screenshots do not indicate that every feature is active on every plan.</p>
          <div className="mt-9 grid gap-6 lg:grid-cols-2">
            <ProductScreenshot shot={solution.primaryShot} alt={solution.primaryShotAlt} caption={solution.title + " · guest and owner experience"} />
            <ProductScreenshot shot={solution.secondaryShot} alt={solution.secondaryShotAlt} caption={solution.title + " · connected workspace"} />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/demo" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700">
              Open the interactive demo <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/docs" className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold">
              Browse product walkthroughs <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
        <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">A fit for your workflow</p>
        <h2 className="font-display mt-4 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          What matters to {solution.title.toLowerCase()}
        </h2>
        <div className="mt-9 grid gap-5 md:grid-cols-3">
          {solution.needs.map((item) => (
            <article key={item.title} className="border-border bg-card flex flex-col rounded-3xl border p-7 shadow-sm">
              <ClipboardCheck className="mb-5 size-8 text-orange-600" aria-hidden="true" />
              <h3 className="font-display text-xl font-bold">{item.title}</h3>
              <p className="text-muted-foreground mt-3 flex-1 text-sm leading-7">{item.detail}</p>
              <Link href={item.featurePath} className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-orange-700 underline underline-offset-4 dark:text-orange-300">
                {item.featureLabel} <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
        <div className="border-border bg-muted/40 mt-10 grid gap-5 rounded-2xl border p-6 md:grid-cols-3">
          {solution.facts.map((fact) => (
            <div key={fact} className="flex gap-3 text-sm leading-7">
              <Check className="mt-1 size-5 shrink-0 text-orange-600" aria-hidden="true" />
              <span>{fact}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border bg-stone-950 px-5 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold tracking-widest text-orange-300 uppercase">From idea to published menu</p>
          <h2 className="font-display mt-4 text-3xl font-extrabold sm:text-4xl">Start simple. Build from there.</h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            {solution.steps.map((step, index) => (
              <article key={step.title} className="rounded-3xl border border-white/15 bg-white/5 p-7">
                <span className="font-display text-3xl font-bold text-orange-300">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="font-display mt-5 text-xl font-bold">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-stone-300">{step.detail}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 max-w-4xl rounded-xl border border-orange-300/20 bg-orange-400/10 px-5 py-4 text-sm leading-7 text-orange-100">
            <strong className="text-white">Important:</strong> {solution.premiumNote}
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">Good to know</p>
          <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight">Questions from {solution.title.toLowerCase()}</h2>
          <p className="text-muted-foreground mt-4 leading-8">
            Need help choosing a setup? <Link href="/contact" className="font-semibold text-orange-700 underline dark:text-orange-300">Ask our team</Link>, or explore <Link href="/pricing" className="font-semibold text-orange-700 underline dark:text-orange-300">pricing and access</Link>.
          </p>
        </div>
        <div className="space-y-3">
          {solution.faqs.map((faq) => (
            <details key={faq.question} className="border-border bg-card rounded-2xl border p-6 open:shadow-sm">
              <summary className="cursor-pointer font-semibold marker:text-orange-600">{faq.question}</summary>
              <p className="text-muted-foreground mt-4 text-sm leading-7">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="rounded-[2rem] bg-gradient-to-br from-[#3a251b] to-stone-950 p-8 text-white sm:p-12">
          <h2 className="font-display max-w-3xl text-3xl font-extrabold sm:text-4xl">Make the first scan a good one.</h2>
          <p className="mt-4 max-w-2xl leading-8 text-stone-300">Start with the free QR menu, experience the demo, or contact MenuMinute about separately enabled tools for your outlet.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold text-stone-950 hover:bg-orange-400">Start free <ArrowRight size={17} aria-hidden="true" /></Link>
            <Link href="/contact" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-stone-500 px-6 py-3 font-bold text-white hover:border-orange-300">Ask about my outlet <ArrowUpRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
        <h2 className="font-display mt-12 text-2xl font-bold">More kinds of food businesses</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {related.map((other) => (
            <Link key={other.slug} href={"/solutions/" + other.slug} className="border-border bg-card group flex min-h-14 items-center justify-between gap-3 rounded-xl border px-5 py-3 font-semibold transition hover:border-orange-500/40">
              {other.title} <ArrowUpRight size={17} className="shrink-0 text-orange-600" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
