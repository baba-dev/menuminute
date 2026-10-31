import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { DocShot } from "@/components/docs/doc-shot";
import { guidesByGroup } from "@/content/docs/guides";

export const metadata: Metadata = {
  title: "Documentation — MenuMinute",
  description:
    "Guides with screenshots for every part of MenuMinute: menus, QR codes, orders, kitchen, reports and the Ember assistant.",
};

export default function DocsIndex() {
  const groups = guidesByGroup();
  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <header className="mb-12 max-w-2xl">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <BookOpen className="h-3.5 w-3.5" />
            Documentation
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">
            Everything MenuMinute does, shown.
          </h1>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed">
            Short guides with real screenshots from the live demo. Each one links to the matching
            screen so you can try it yourself, no sign-up required.
          </p>
          <Link
            href="/demo"
            className="bg-brand-600 hover:bg-brand-700 mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors"
          >
            Open the live demo <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {groups.map(({ group, guides }) => (
          <section key={group} aria-labelledby={`g-${group}`} className="mb-14">
            <h2
              id={`g-${group}`}
              className="text-muted-foreground mb-5 text-xs font-semibold tracking-widest uppercase"
            >
              {group}
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/docs/${guide.slug}`}
                    className="border-border bg-card group flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-lg focus-visible:ring-2"
                  >
                    {guide.shot ? (
                      <div className="pointer-events-none">
                        <DocShot id={guide.shot} title={guide.title} />
                      </div>
                    ) : (
                      <div className="bg-muted text-muted-foreground flex aspect-[8/5] items-center justify-center text-sm">
                        Not shown in the public demo
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <h3 className="font-display text-lg font-bold">{guide.title}</h3>
                      <p className="text-muted-foreground flex-1 text-sm leading-relaxed">
                        {guide.summary}
                      </p>
                      <span className="text-brand-700 dark:text-brand-400 mt-2 inline-flex items-center gap-1 text-sm font-semibold">
                        Read the guide
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <PublicFooter />
    </div>
  );
}
