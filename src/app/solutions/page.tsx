import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { industrySolutions } from "@/content/marketing/solutions";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "QR Menu Solutions for Restaurants, Cafés, Bakeries & Cloud Kitchens",
  description: "Find your MenuMinute setup: free QR menus for restaurants, cafés, bakeries and cloud kitchens. Explore real product screenshots, examples and access requirements.",
  pathname: "/solutions",
  image: "/docs-media/public-menu-desktop-light.webp",
  imageAlt: "MenuMinute public menu example",
});

export default function SolutionsPage() {
  return (
    <MarketingPageShell>
      <section className="border-border via-background border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10 px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <span className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">Solutions by industry</span>
          <h1 className="font-display mt-5 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Your kind of food business. <span className="text-orange-600 dark:text-orange-400">Your kind of menu.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
            A restaurant table, a coffee counter, a bakery display and a pickup kitchen all work differently. Explore a tailored starting point for each, with real MenuMinute screenshots and clearly explained premium options.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700">
              Create a free menu <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link href="/demo" className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold">
              Try the demo <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <h2 className="font-display text-3xl font-extrabold">Choose your food business</h2>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">Each guide includes a realistic illustrative workflow, screenshots of the product and practical steps to launch a menu.</p>
        <div className="mt-9 grid gap-6 md:grid-cols-2">
          {industrySolutions.map((solution) => (
            <article key={solution.slug} className="border-border bg-card group flex min-w-0 flex-col overflow-hidden rounded-3xl border shadow-sm transition hover:border-orange-500/40 hover:shadow-lg">
              <div className="relative aspect-[16/8] overflow-hidden">
                <Image src={solution.cover} alt={solution.coverAlt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
              </div>
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <span className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">{solution.audience}</span>
                <h3 className="font-display mt-3 text-3xl font-extrabold">{solution.title}</h3>
                <p className="text-muted-foreground mt-4 flex-1 leading-7">{solution.intro}</p>
                <Link href={"/solutions/" + solution.slug} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-orange-700 underline underline-offset-4 dark:text-orange-300">
                  Explore {solution.title.toLowerCase()} <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="border-border bg-muted/40 border-y px-5 py-14">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {["Start with a free QR menu", "Publish updated prices and availability", "Explore separately activated ordering and kitchen tools"].map((item) => (
            <p key={item} className="flex items-start gap-3 text-sm leading-7 font-semibold">
              <Check className="mt-1 size-5 shrink-0 text-orange-600" aria-hidden="true" /> {item}
            </p>
          ))}
        </div>
      </section>
    </MarketingPageShell>
  );
}
