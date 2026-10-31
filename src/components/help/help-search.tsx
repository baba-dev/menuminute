"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X, BookOpen, Utensils, Store, ArrowRight } from "lucide-react";
import { searchHelpArticles, type Audience } from "@/content/help";

interface HelpSearchProps {
  initialAudience?: Audience;
  placeholder?: string;
}

export function HelpSearch({
  initialAudience = "both",
  placeholder = "Search guides (e.g. 'permanent QR', 'dietary filters', 'kitchen display', '86 sold out')...",
}: HelpSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedAudience, setSelectedAudience] = useState<Audience>(initialAudience);

  const results = useMemo(() => {
    return searchHelpArticles(query, selectedAudience);
  }, [query, selectedAudience]);

  return (
    <div className="w-full">
      <div className="relative mx-auto max-w-2xl">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-4 size-5 text-stone-400" />
          <input
            type="search"
            aria-label="Search help guides"
            autoComplete="off"
            onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-stone-200/90 bg-white py-4 pr-12 pl-12 text-sm shadow-sm transition-all placeholder:text-stone-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 focus:outline-none sm:text-base dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* Audience filter pills */}
        <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedAudience("both")}
            aria-pressed={selectedAudience === "both"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
              selectedAudience === "both"
                ? "bg-stone-900 text-white shadow-sm dark:bg-stone-100 dark:text-stone-900"
                : "border border-stone-200/80 bg-white text-stone-600 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
            }`}
          >
            <BookOpen className="size-3.5" /> All Guides
          </button>
          <button
            type="button"
            onClick={() => setSelectedAudience("owner")}
            aria-pressed={selectedAudience === "owner"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
              selectedAudience === "owner"
                ? "bg-orange-600 text-white shadow-sm"
                : "border border-orange-200/70 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-300"
            }`}
          >
            <Store className="size-3.5" /> For Restaurant Owners
          </button>
          <button
            type="button"
            onClick={() => setSelectedAudience("customer")}
            aria-pressed={selectedAudience === "customer"}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
              selectedAudience === "customer"
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-emerald-200/70 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-950/40 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            <Utensils className="size-3.5" /> For Diners &amp; Guests
          </button>
        </div>

        {/* Live Search Results Dropdown */}
        {query.trim().length >= 2 && (
          <div role="region"
            aria-label="Matching help guides"
            className="absolute top-full z-30 mt-2 max-h-96 w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-xl dark:border-stone-800 dark:bg-stone-900">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map(({ article, snippet }) => (
                  <Link
                    key={article.id}
                    href={`/help/${article.audience}/${article.slug}`}
                    className="group flex items-start justify-between rounded-xl p-3 transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-950/20"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold tracking-wider text-orange-600 uppercase dark:text-orange-400">
                          {article.category}
                        </span>
                        <span className="text-stone-300">•</span>
                        <span className="text-xs text-stone-400">
                          {article.readTimeMinutes} min read
                        </span>
                      </div>
                      <h4 className="mt-0.5 text-sm font-bold text-stone-900 group-hover:text-orange-600 dark:text-stone-100 dark:group-hover:text-orange-400">
                        {article.title}
                      </h4>
                      <p className="mt-1 line-clamp-1 text-xs text-stone-500 dark:text-stone-400">
                        {snippet}
                      </p>
                    </div>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-1 group-hover:text-orange-600 dark:text-stone-600 dark:group-hover:text-orange-400" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-stone-500">
                <p>No guides found for &ldquo;{query}&rdquo;.</p>
                <p className="mt-1 text-xs text-stone-400">
                  Try searching for &quot;QR&quot;, &quot;Menu&quot;, &quot;Kitchen&quot;, or check
                  our{" "}
                  <Link href="/help/faq" className="text-orange-600 underline">
                    FAQs
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
