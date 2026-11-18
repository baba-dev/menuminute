import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { Bilingual, ChapterArt, Recap, StepView } from "@/components/guide/guide-parts";
import { CHAPTER_LIST, SUPPORT } from "@/content/guide/content";
import { CHAPTERS } from "@/content/guide/chapters";
import { CH11 } from "@/content/guide/help";

interface PageProps {
  params: Promise<{ chapter: string }>;
}

export function generateStaticParams() {
  return CHAPTER_LIST.map((c) => ({ chapter: String(c.no) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { chapter } = await params;
  const item = CHAPTER_LIST.find((c) => String(c.no) === chapter);
  if (!item) return { title: "Guide chapter not found" };
  return {
    title: `Chapter ${item.no}: ${item.title.en} — MenuMinute Guide`,
    alternates: { canonical: `/help/guide/${item.no}` },
  };
}

export default async function GuideChapterPage({ params }: PageProps) {
  const { chapter: raw } = await params;
  const no = Number(raw);
  const item = CHAPTER_LIST.find((c) => c.no === no);
  if (!item) notFound();
  const chapter = CHAPTERS.find((c) => c.no === no);
  const prev = CHAPTER_LIST.find((c) => c.no === no - 1);
  const next = CHAPTER_LIST.find((c) => c.no === no + 1);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <MarketingSubpageNav />
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
          <Link href="/help/guide" className="hover:text-orange-600">
            User Guide · उपयोग की गाइड
          </Link>
        </nav>
        <div className="overflow-hidden rounded-3xl border border-stone-200 dark:border-stone-800">
          <ChapterArt no={no} priority />
          <div className="bg-orange-600 px-6 py-3 text-white">
            <Bilingual text={chapter ? chapter.tagline : CH11.tagline} />
          </div>
        </div>
        <header>
          <p className="text-xs font-bold tracking-widest text-orange-600 uppercase">
            Chapter {no} · अध्याय {no}
          </p>
          <h1 className="font-display mt-2 text-3xl font-extrabold sm:text-4xl">
            <Bilingual text={item.title} hiClass="text-orange-600" />
          </h1>
          <ul className="mt-4 space-y-2">
            {(chapter ? chapter.learn : CH11.learn).map((l, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-3 shrink-0 rounded-full bg-orange-600"
                />
                <span>
                  <Bilingual text={l} hiClass="text-muted-foreground" />
                </span>
              </li>
            ))}
          </ul>
        </header>

        {chapter ? (
          <>
            {chapter.steps.map((s) => (
              <StepView key={s.no} chapter={chapter} step={s} />
            ))}
            <Recap chapter={chapter} />
          </>
        ) : (
          <>
            <section>
              <h2 className="font-display text-2xl font-extrabold">
                <Bilingual text={CH11.fixTitle} hiClass="text-orange-600" />
              </h2>
              <dl className="mt-4 space-y-3">
                {CH11.fixes.map((f, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border-l-4 border-orange-600 bg-orange-50 p-4 dark:bg-stone-900"
                  >
                    <dt className="font-bold">
                      <Bilingual text={f.q} hiClass="text-orange-700" />
                    </dt>
                    <dd className="mt-1">
                      <Bilingual text={f.a} hiClass="text-muted-foreground" />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h2 className="font-display text-2xl font-extrabold">
                <Bilingual text={CH11.glossaryTitle} hiClass="text-orange-600" />
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {CH11.glossary.map((g, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800"
                  >
                    <dt className="font-bold">
                      <Bilingual text={g.term} hiClass="text-orange-700" />
                    </dt>
                    <dd className="mt-1 text-sm">
                      <Bilingual text={g.text} hiClass="text-muted-foreground" />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="rounded-3xl bg-orange-600 p-6 text-white">
              <h2 className="font-display text-2xl font-extrabold">
                <Bilingual text={CH11.contact.title} />
              </h2>
              <p className="mt-2">
                <Bilingual text={CH11.contact.intro} />
              </p>
              <p className="mt-4 text-lg font-bold">
                ✉ {SUPPORT.email} · WhatsApp {SUPPORT.whatsapp}
              </p>
            </section>
          </>
        )}

        <nav
          aria-label="Chapter navigation"
          className="flex justify-between gap-4 text-sm font-semibold"
        >
          {prev ? (
            <Link href={`/help/guide/${prev.no}`} className="hover:text-orange-600">
              ← {prev.title.en}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/help/guide/${next.no}`} className="hover:text-orange-600">
              {next.title.en} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}
