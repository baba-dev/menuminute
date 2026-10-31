import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb, ListChecks, PlayCircle } from "lucide-react";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { DocShot, PhoneShot } from "@/components/docs/doc-shot";
import { GUIDES, guideBySlug } from "@/content/docs/guides";

export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const guide = guideBySlug((await params).slug);
  return guide
    ? { title: `${guide.title} — MenuMinute documentation`, description: guide.summary }
    : {};
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = guideBySlug((await params).slug);
  if (!guide) notFound();
  const related = guide.related.map((slug) => guideBySlug(slug)).filter((g) => g !== undefined);
  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
        <Link
          href="/docs"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> All guides
        </Link>
        <header className="mb-8">
          <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
            {guide.group}
          </p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {guide.title}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-base leading-relaxed">
            {guide.summary}
          </p>
          {!guide.inDemo && (
            <p
              role="note"
              className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
            >
              This feature is not available in the public demo.
            </p>
          )}
        </header>

        {guide.shot && (
          <div className="mb-10 grid items-start gap-6 md:grid-cols-[1fr_13rem]">
            <DocShot id={guide.shot} title={guide.title} priority />
            <div className="hidden md:block">
              <PhoneShot id={guide.shot} title={guide.title} />
            </div>
          </div>
        )}

        {guide.moreShots?.map((id) => (
          <div key={id} className="mb-10">
            <DocShot id={id} title={guide.title} />
          </div>
        ))}

        <section aria-labelledby="what" className="mb-10">
          <h2 id="what" className="font-display mb-3 text-xl font-bold">
            What it does
          </h2>
          <ul className="text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed">
            {guide.whatItDoes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="steps" className="mb-10">
          <h2 id="steps" className="font-display mb-3 flex items-center gap-2 text-xl font-bold">
            <ListChecks className="text-brand-600 h-5 w-5" /> How to use it
          </h2>
          <ol className="space-y-3">
            {guide.steps.map((step, index) => (
              <li key={step} className="border-border bg-card flex gap-3 rounded-xl border p-4">
                <span className="bg-brand-600 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {guide.tips.length > 0 && (
          <section aria-labelledby="tips" className="mb-10">
            <h2 id="tips" className="font-display mb-3 flex items-center gap-2 text-xl font-bold">
              <Lightbulb className="h-5 w-5 text-amber-500" /> Good to know
            </h2>
            <ul className="text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed">
              {guide.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </section>
        )}

        {guide.tryIt && (
          <div className="border-border bg-muted/50 mb-12 flex flex-col items-start justify-between gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-display flex items-center gap-2 text-lg font-bold">
                <PlayCircle className="text-brand-600 h-5 w-5" /> Try it yourself
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                {guide.tryIt.href.startsWith("/m/") || guide.tryIt.href === "/demo"
                  ? "Opens in the live demo. No sign-up needed."
                  : "Enter the demo first, then open this screen. No sign-up needed."}
              </p>
            </div>
            <Link
              href={
                guide.tryIt.href.startsWith("/m/") || guide.tryIt.href === "/demo"
                  ? guide.tryIt.href
                  : "/demo"
              }
              className="bg-brand-600 hover:bg-brand-700 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors"
            >
              {guide.tryIt.href.startsWith("/m/") || guide.tryIt.href === "/demo"
                ? guide.tryIt.label
                : "Go to the demo"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {related.length > 0 && (
          <nav aria-label="Related guides">
            <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-widest uppercase">
              Related guides
            </h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/docs/${r.slug}`}
                    className="border-border bg-card hover:bg-muted inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
