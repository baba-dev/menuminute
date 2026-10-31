"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { HelpCircle, Search, ChevronDown, BookOpen } from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { FaqJsonLd } from "@/components/help/help-jsonld";
import { allFaqs } from "@/content/help";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

export default function FaqPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const set = new Set(allFaqs.map((f) => f.category || "General"));
    return ["all", ...Array.from(set)];
  }, []);

  const filteredFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFaqs.filter((f) => {
      const matchCat = selectedCategory === "all" || f.category === selectedCategory;
      const matchSearch =
        !q ||
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        (f.category && f.category.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [search, selectedCategory]);

  const toggle = (q: string) => {
    setOpenItems((prev) => ({ ...prev, [q]: !prev[q] }));
  };

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <FaqJsonLd faqs={allFaqs} />
      <MarketingSubpageNav />
      <HelpBreadcrumbs
        items={[{ label: "Frequently Asked Questions" }]}
        backLink={{ label: "Help Center", href: "/help" }}
      />

      <section className="border-b border-stone-200/80 bg-gradient-to-b from-orange-500/10 to-stone-50 px-4 py-16 text-center sm:px-6 lg:px-8 dark:border-stone-800 dark:from-orange-950/20 dark:to-stone-950">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <HelpCircle className="size-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Quick Answers to Common Inquiries
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base sm:text-lg">
            Straightforward answers about our free forever plans, permanent QR stickers, kitchen
            tablets, and guest ordering.
          </p>

          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-4 size-4 text-stone-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions (e.g. 'pricing', 'stickers', 'offline')..."
                className="w-full rounded-2xl border border-stone-200/90 bg-white py-3.5 pr-4 pl-11 text-sm shadow-sm transition placeholder:text-stone-400 focus:border-orange-500 focus:outline-none dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
              />
            </div>

            {/* Category tabs */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3.5 py-1 text-xs font-semibold capitalize transition ${
                    selectedCategory === cat
                      ? "bg-orange-600 text-white shadow-xs"
                      : "border border-stone-200/80 bg-white text-stone-600 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
                  }`}
                >
                  {cat === "all" ? "All Questions" : cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        {filteredFaqs.length > 0 ? (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => {
              const isOpen = Boolean(openItems[faq.question]);
              return (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xs transition hover:border-orange-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
                >
                  <button
                    type="button"
                    onClick={() => toggle(faq.question)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-stone-900 transition hover:text-orange-600 dark:text-stone-100 dark:hover:text-orange-400"
                    aria-expanded={isOpen}
                  >
                    <span className="pr-4">{faq.question}</span>
                    <ChevronDown
                      className={`size-4 shrink-0 text-stone-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-orange-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-stone-100 bg-stone-50/50 p-5 text-sm leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-300">
                      <p>{faq.answer}</p>
                      {faq.category && (
                        <div className="mt-3">
                          <span className="rounded-md border border-stone-200/80 bg-stone-100 px-2.5 py-0.5 text-[10px] font-bold text-stone-700 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300">
                            {faq.category}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-stone-200/80 bg-white p-8 text-center text-sm text-stone-500 dark:border-stone-800 dark:bg-stone-900">
            <p>No questions matched &ldquo;{search}&rdquo;.</p>
            <p className="mt-2 text-xs">
              Need more help? Check our{" "}
              <Link href="/help/owner" className="font-semibold text-orange-600 underline">
                Restaurant Guides
              </Link>{" "}
              or{" "}
              <Link href="/help/customer" className="font-semibold text-emerald-600 underline">
                Diner Guides
              </Link>
              .
            </p>
          </div>
        )}

        <div className="mt-16 rounded-3xl border border-orange-200/80 bg-orange-50/50 p-8 text-center dark:border-orange-900/40 dark:bg-orange-950/20">
          <h3 className="font-display text-lg font-bold text-orange-950 dark:text-orange-200">
            Looking for illustrated step-by-step walkthroughs?
          </h3>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-xs sm:text-sm">
            Our illustrated articles take you through every screen and button in MenuMinute.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/help/owner"
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
            >
              <BookOpen className="size-3.5" /> Read Owner Guides
            </Link>
            <Link
              href="/help/customer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-orange-300 bg-white px-4 py-2 text-xs font-bold text-orange-900 shadow-sm hover:bg-orange-50 dark:border-stone-700 dark:bg-stone-900 dark:text-orange-200"
            >
              Read Diner Guides
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
