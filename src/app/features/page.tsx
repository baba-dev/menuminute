import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { marketingFeatures } from "@/content/marketing/features";
import { industrySolutions } from "@/content/marketing/solutions";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "Restaurant QR Menu, Ordering, POS and Kitchen Features",
  description:
    "Explore MenuMinute's free QR menus, digital menu builder, online ordering, kitchen display, POS and AI menu import. Learn which features require approval.",
  pathname: "/features",
});

export default function FeaturesPage() {
  return (
    <MarketingPageShell>
      <section className="border-border via-background border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10 px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">
            Explore all features
          </p>
          <h1 className="font-display mt-5 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            A better menu today.{" "}
            <span className="text-orange-600 dark:text-orange-400">
              More possibilities tomorrow.
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
            Start with a free, permanently accessible QR menu. Explore connected service tools with
            clear information about access, approvals and optional providers.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-orange-600 px-6 py-3 font-bold text-white hover:bg-orange-700"
          >
            Create a free menu <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
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
                      sizes="(max-width: 768px) 100vw, 50vw"
                      alt={feature.imageAlt || feature.title}
                      className="h-full w-full object-contain object-center dark:hidden"
                    />
                    <Image
                      src={"/docs-media/" + feature.image + "-desktop-dark.webp"}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      alt={feature.imageAlt || feature.title}
                      className="hidden h-full w-full object-contain object-center dark:block"
                    />
                  </>
                ) : (
                  <>
                    <Image
                      src={feature.heroArtwork.desktopLight}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      alt={feature.heroArtwork.alt}
                      className="h-full w-full object-cover object-center dark:hidden"
                    />
                    <Image
                      src={feature.heroArtwork.desktopDark}
                      width={720}
                      height={450}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      alt={feature.heroArtwork.alt}
                      className="hidden h-full w-full object-cover object-center dark:block"
                    />
                  </>
                )}
              </div>
              <div className="flex flex-1 flex-col p-7">
                <span className="text-xs font-bold tracking-wider text-orange-700 uppercase dark:text-orange-300">
                  {feature.availability === "free"
                    ? "Free core features"
                    : feature.availability === "limited"
                      ? "Limited access"
                      : "Provider-gated"}
                </span>
                <h2 className="font-display mt-3 text-2xl font-bold">{feature.title}</h2>
                <p className="text-muted-foreground mt-3 flex-1 text-sm leading-7">
                  {feature.description}
                </p>
                <Link
                  href={feature.path}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-orange-700 hover:underline dark:text-orange-300"
                >
                  Explore feature <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="border-border bg-muted/30 border-t px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold tracking-widest text-orange-700 uppercase dark:text-orange-300">
            Solutions by industry
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold">
            Find a fit for your food business.
          </h2>
          <p className="text-muted-foreground mt-4 max-w-2xl leading-7">
            Explore realistic examples and see how the same product adapts to different restaurant,
            café, bakery and pickup-kitchen workflows.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {industrySolutions.map((solution) => (
              <Link
                key={solution.slug}
                href={"/solutions/" + solution.slug}
                className="border-border bg-card group flex min-h-16 items-center justify-between gap-3 rounded-2xl border p-5 font-bold transition hover:border-orange-500/40 hover:shadow-sm"
              >
                {solution.title}{" "}
                <ArrowUpRight size={17} className="shrink-0 text-orange-600" aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link
            href="/solutions"
            className="mt-6 inline-flex min-h-11 items-center gap-2 font-semibold text-orange-700 underline underline-offset-4 dark:text-orange-300"
          >
            Compare all solutions <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </MarketingPageShell>
  );
}
