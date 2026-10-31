import React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Clock,
  Calendar,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { HelpReadingProgress } from "@/components/help/help-reading-progress";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpHeroImage } from "@/components/help/help-hero-image";
import { HelpTableOfContents } from "@/components/help/help-toc";
import { HelpFeedback } from "@/components/help/help-feedback";
import { HelpVisualCard } from "@/components/help/help-visuals";
import { HelpArticleJsonLd } from "@/components/help/help-jsonld";
import { HelpCard } from "@/components/help/help-card";
import { ownerArticles, getArticleBySlug, getRelatedArticles } from "@/content/help";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return ownerArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article || article.audience !== "owner") return { title: "Article Not Found" };

  return {
    title: `${article.title} — MenuMinute Owner Guide`,
    description: article.summary,
    keywords: article.keywords,
    alternates: { canonical: `/help/${article.audience}/${article.slug}` },
    openGraph: {
      title: `${article.title} — Restaurant Owner Guide`,
      description: article.summary,
      type: "article",
      publishedTime: article.lastUpdated,
    },
  };
}

export default async function OwnerArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article || article.audience !== "owner") {
    notFound();
  }

  const related = getRelatedArticles(article);
  const currentUrl = `https://food.bababuilds.com/help/owner/${article.slug}`;
  const tocSections = article.sections.map((s) => ({ id: s.id, title: s.title }));

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <HelpArticleJsonLd article={article} url={currentUrl} />
      <HelpReadingProgress />
      <MarketingSubpageNav />
      <HelpBreadcrumbs
        items={[{ label: "Owner Guides", href: "/help/owner" }, { label: article.category }]}
        backLink={{ label: "Owner Guides", href: "/help/owner" }}
      />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* Main Article Content */}
          <article className="lg:col-span-8">
            {/* Article Header */}
            <header className="border-b border-stone-200/80 pb-8 dark:border-stone-800">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="rounded-full border border-orange-200/80 bg-orange-50 px-3 py-1 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300">
                  {article.category}
                </span>
                {article.difficulty && (
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                    {article.difficulty}
                  </span>
                )}
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <div className="flex items-center gap-1 text-stone-500">
                  <Clock className="size-3.5" />
                  <span>{article.readTimeMinutes} min read</span>
                </div>
                <span className="text-stone-300 dark:text-stone-700">•</span>
                <div className="flex items-center gap-1 text-stone-500">
                  <Calendar className="size-3.5" />
                  <span>Updated {article.lastUpdated}</span>
                </div>
              </div>

              <h1 className="font-display mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                {article.title}
              </h1>
              <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
                {article.subtitle}
              </p>

              {/* Top Dashboard Action Callout */}
              {article.dashboardLink && (
                <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-orange-200/80 bg-orange-50/60 p-4 sm:flex-row sm:items-center dark:border-orange-900/40 dark:bg-orange-950/20">
                  <div className="text-xs text-orange-950 dark:text-orange-200">
                    <span className="font-bold">Ready to try this in your restaurant?</span> Jump
                    directly to your workspace.
                  </div>
                  <Link
                    href={article.dashboardLink.href}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700"
                  >
                    <span>{article.dashboardLink.label}</span>
                    <ExternalLink className="size-3.5" />
                  </Link>
                </div>
              )}
            </header>

            {/* Hero Image */}
            {article.heroImage && (
              <HelpHeroImage
                src={article.heroImage.src}
                alt={article.heroImage.alt}
                caption={article.heroImage.caption}
                badge={`Illustration · ${article.category}`}
              />
            )}

            {/* Quick Steps Checklist */}
            {article.quickSteps && article.quickSteps.length > 0 && (
              <div className="my-8 rounded-3xl border border-stone-200/80 bg-white p-7 shadow-sm dark:border-stone-800 dark:bg-stone-900">
                <h2 className="flex items-center gap-2 text-xs font-bold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                  <CheckCircle2 className="size-4" /> Quick Steps Summary
                </h2>
                <ol className="mt-4 space-y-3 text-sm">
                  {article.quickSteps.map((step, idx) => (
                    <li key={step} className="flex items-start gap-3.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                        {idx + 1}
                      </span>
                      <span id={`step-${idx + 1}`} className="scroll-mt-28 text-stone-800 dark:text-stone-200">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Embedded Visual Mockup Component */}
            {article.visualMockup && (
              <HelpVisualCard
                type={article.visualMockup.type}
                caption={article.visualMockup.caption}
              />
            )}

            {/* Article Body Sections */}
            <div className="space-y-12">
              {article.sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-24">
                  <h2 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                    {section.title}
                  </h2>
                  <div className="mt-4 space-y-3.5 text-base leading-relaxed text-stone-700 dark:text-stone-300">
                    {section.content.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {/* Step Action Cards */}
                  {section.steps && section.steps.length > 0 && (
                    <div className="my-6 space-y-4 rounded-2xl border border-stone-200/80 bg-stone-50/60 p-6 dark:border-stone-800 dark:bg-stone-900/40">
                      {section.steps.map((step) => (
                        <div key={step.stepNumber} className="flex items-start gap-4">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white shadow-sm">
                            {step.stepNumber}
                          </span>
                          <div>
                            <h4 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                              {step.title}
                            </h4>
                            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                              {step.description}
                            </p>
                            {step.highlightAction && (
                              <span className="mt-2 inline-block rounded-md border border-orange-200/80 bg-orange-50 px-2.5 py-0.5 font-mono text-xs font-medium text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300">
                                {step.highlightAction}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Callout Blocks */}
                  {section.callout && (
                    <div
                      className={`my-6 flex items-start gap-3.5 rounded-2xl p-5 text-sm ${
                        section.callout.type === "pitfall"
                          ? "border border-rose-200 bg-rose-50/70 text-rose-950 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200"
                          : section.callout.type === "delight"
                            ? "border border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
                            : "border border-orange-200 bg-orange-50/70 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200"
                      }`}
                    >
                      {section.callout.type === "pitfall" ? (
                        <AlertTriangle className="size-5 shrink-0 text-rose-600" />
                      ) : section.callout.type === "delight" ? (
                        <Sparkles className="size-5 shrink-0 text-amber-600" />
                      ) : (
                        <Lightbulb className="size-5 shrink-0 text-orange-600" />
                      )}
                      <div>
                        <h5 className="font-bold">{section.callout.title}</h5>
                        <p className="mt-1 text-xs leading-relaxed sm:text-sm">
                          {section.callout.text}
                        </p>
                      </div>
                    </div>
                  )}

                  {section.proTip && !section.callout && (
                    <div className="my-6 flex items-start gap-3.5 rounded-2xl border border-orange-200 bg-orange-50/60 p-5 text-sm text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-200">
                      <Lightbulb className="size-5 shrink-0 text-orange-600" />
                      <div>
                        <span className="font-bold">Hospitality Pro Tip: </span>
                        <span>{section.proTip}</span>
                      </div>
                    </div>
                  )}
                </section>
              ))}
            </div>

            {/* Bottom Dashboard Action Callout */}
            {article.dashboardLink && (
              <div className="mt-12 rounded-3xl border border-orange-200/80 bg-gradient-to-r from-orange-50/80 to-amber-50/60 p-8 text-center dark:border-orange-900/40 dark:from-stone-900 dark:to-orange-950/20">
                <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                  Ready to put this guide into practice?
                </h3>
                <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-sm">
                  Jump into your MenuMinute dashboard and make changes directly.
                </p>
                <div className="mt-5">
                  <Link
                    href={article.dashboardLink.href}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
                  >
                    <span>{article.dashboardLink.label}</span>
                    <ExternalLink className="size-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* Contextual FAQs */}
            {article.faqs && article.faqs.length > 0 && (
              <section className="mt-14 border-t border-stone-200/80 pt-10 dark:border-stone-800">
                <h3 className="font-display flex items-center gap-2 text-xl font-bold text-stone-900 dark:text-stone-100">
                  <HelpCircle className="size-5 text-orange-600" /> Frequently Asked Questions
                </h3>
                <div className="mt-5 space-y-3">
                  {article.faqs.map((faq) => (
                    <div
                      key={faq.question}
                      className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
                    >
                      <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                        {faq.question}
                      </h4>
                      <p className="mt-2 text-xs leading-relaxed text-stone-600 sm:text-sm dark:text-stone-400">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Article Feedback Widget */}
            <HelpFeedback articleTitle={article.title} />

            {/* Related Articles */}
            {related.length > 0 && (
              <section className="mt-14 border-t border-stone-200/80 pt-10 dark:border-stone-800">
                <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                  Related Restaurant Guides
                </h3>
                <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((rel) => (
                    <HelpCard key={rel.id} article={rel} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* Sticky Sidebar: Table of Contents */}
          <aside className="hidden lg:col-span-4 lg:block">
            <HelpTableOfContents sections={tocSections} />
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
