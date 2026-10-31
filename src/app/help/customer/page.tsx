import React from "react";
import type { Metadata } from "next";
import { Utensils } from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { HelpBreadcrumbs } from "@/components/help/help-breadcrumbs";
import { HelpSearch } from "@/components/help/help-search";
import { HelpCard } from "@/components/help/help-card";
import { customerArticles } from "@/content/help";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

export const metadata: Metadata = {
  title: "Diner & Guest Guides — MenuMinute Help Center",
  description:
    "Help for dining guests: Learn how to scan table QR codes, browse dishes, filter allergens, customize meals, track orders, and call your server.",
  openGraph: {
    title: "MenuMinute Guides for Diners & Guests",
    description:
      "Simple, friendly guides for guests scanning and ordering from digital restaurant menus.",
  },
};

export default function CustomerHelpDirectoryPage() {
  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />
      <HelpBreadcrumbs
        items={[{ label: "Diner & Guest Experience Guides" }]}
        backLink={{ label: "All Guides", href: "/help" }}
      />

      <section className="border-b border-stone-200/80 bg-gradient-to-b from-emerald-500/10 to-stone-50 px-4 py-16 text-center sm:px-6 lg:px-8 dark:border-stone-800 dark:from-emerald-950/20 dark:to-stone-950">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Utensils className="size-3.5" />
            <span>Dining Guests &amp; Customers</span>
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Diner &amp; Guest Experience Guides
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-base sm:text-lg">
            Everything you need to know about scanning QR menus, customizing dishes, tracking meal
            preparation, and requesting service from your phone.
          </p>

          <div className="mt-8">
            <HelpSearch initialAudience="customer" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {customerArticles.map((article) => (
            <HelpCard key={article.id} article={article} />
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
