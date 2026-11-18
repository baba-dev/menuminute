import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { Bilingual, ChapterArt } from "@/components/guide/guide-parts";
import { COVER, HOW_TO_READ, CHAPTER_LIST, SUPPORT } from "@/content/guide/content";

export const metadata: Metadata = {
  alternates: { canonical: "/help/guide" },
  title: "User Operation Guide (English + हिंदी) — MenuMinute",
  description:
    "A step-by-step visual guide for restaurant owners and staff, in English and Hindi. Set up your menu, QR codes, orders, kitchen and reports.",
};

export default function GuideIndexPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <MarketingSubpageNav />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-stone-200 dark:border-stone-800">
          <ChapterArt no={0} priority />
          <div className="bg-orange-600 px-6 py-3 text-white">
            <Bilingual text={COVER.strip} />
          </div>
        </div>
        <p className="mt-8 text-xs font-bold tracking-widest text-orange-600 uppercase">
          <Bilingual text={COVER.eyebrow} />
        </p>
        <h1 className="font-display mt-2 text-4xl font-extrabold sm:text-5xl">
          <span className="block">{COVER.line1.en}</span>
          <span className="block text-orange-600">{COVER.line2.en}</span>
          <span lang="hi" className="block text-orange-600">
            {COVER.line1.hi} {COVER.line2.hi}
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-lg">
          <Bilingual text={COVER.sub} hiClass="text-muted-foreground mt-1" />
        </p>

        <a
          href="/guide/MenuMinute-User-Guide.pdf"
          download
          className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-orange-600 px-5 py-3 font-semibold text-white shadow-sm hover:bg-orange-700"
        >
          <Download className="size-5" aria-hidden="true" />
          <span>
            <span className="block">Download the PDF (about 11 MB)</span>
            <span lang="hi" className="block text-sm font-normal">
              PDF डाउनलोड कीजिए (लगभग 11 MB)
            </span>
          </span>
        </a>

        <h2 className="font-display mt-12 text-2xl font-extrabold">
          <Bilingual text={HOW_TO_READ.title} hiClass="text-orange-600" />
        </h2>
        <p className="mt-2">
          <Bilingual text={HOW_TO_READ.intro} hiClass="text-muted-foreground" />
        </p>

        <h2 className="font-display mt-12 text-2xl font-extrabold">
          <Bilingual text={{ en: "Chapters", hi: "चैप्टर" }} hiClass="text-orange-600" />
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          {CHAPTER_LIST.map((c) => (
            <li key={c.no}>
              <Link
                href={`/help/guide/${c.no}`}
                className="flex gap-3 rounded-2xl border border-stone-200 p-4 transition hover:border-orange-500 dark:border-stone-800"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-orange-100 font-bold text-orange-700">
                  {c.no}
                </span>
                <span>
                  <Bilingual text={c.title} enClass="font-bold" hiClass="text-muted-foreground" />
                </span>
              </Link>
            </li>
          ))}
        </ol>

        <p className="text-muted-foreground mt-12 text-sm">
          <Bilingual
            text={{
              en: "Need help? Email or WhatsApp us.",
              hi: "मदद चाहिए? हमें ईमेल या WhatsApp कीजिए।",
            }}
          />
          <span className="mt-1 block">
            {SUPPORT.email} · WhatsApp {SUPPORT.whatsapp}
          </span>
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}
