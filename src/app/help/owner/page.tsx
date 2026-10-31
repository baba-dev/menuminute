import React from "react";
import type { Metadata } from "next";
import { Store } from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpSearch } from "@/components/help/help-search";
import { HelpCard } from "@/components/help/help-card";
import { ownerArticles, getCategories } from "@/content/help";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

export const metadata: Metadata = {
  title: "Restaurant Owner & Staff Guides — MenuMinute Help Center",
  description:
    "Comprehensive, user-friendly guides for restaurant operators: Menu Studio, QR tabletop press, Kitchen Pro, Dish Availability, Point of Sale, and daily reports.",
  openGraph: {
    title: "MenuMinute Guides for Restaurant Owners & Staff",
    description: "Step-by-step guides covering every page and operational tool in MenuMinute.",
  },
};

export default function OwnerHelpDirectoryPage() {
  const categories = getCategories("owner");

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />
      <HelpBreadcrumbs
        items={[{ label: "Restaurant Owner & Staff Guides" }]}
        backLink={{ label: "All Guides", href: "/help" }}
      />

      <section className="border-b border-stone-200/80 bg-gradient-to-b from-orange-500/10 to-stone-50 px-4 py-16 text-center sm:px-6 lg:px-8 dark:border-stone-800 dark:from-orange-950/20 dark:to-stone-950">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <Store className="size-3.5" />
            <span>Restaurant Operations &amp; Management</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Operator &amp; Staff Guides
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base sm:text-lg">
            Step-by-step instructions to help you set up dishes, print permanent QR stickers, run
            your kitchen display, and manage daily sales.
          </p>

          <div className="mt-8">
            <HelpSearch initialAudience="owner" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="space-y-16">
          {categories.map((category) => {
            const categoryArticles = ownerArticles.filter((a) => a.category === category);
            if (categoryArticles.length === 0) return null;

            return (
              <section key={category}>
                <div className="flex items-center gap-3 border-b border-stone-200/80 pb-4 dark:border-stone-800">
                  <h2 className="font-display text-2xl font-bold text-stone-900 dark:text-stone-100">
                    {category}
                  </h2>
                  <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
                    {categoryArticles.length} {categoryArticles.length === 1 ? "guide" : "guides"}
                  </span>
                </div>
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryArticles.map((article) => (
                    <HelpCard key={article.id} article={article} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
