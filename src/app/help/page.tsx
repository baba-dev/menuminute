import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Store, Utensils, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { HelpSearch } from "@/components/help/help-search";
import { HelpCard } from "@/components/help/help-card";
import { HelpHeroImage } from "@/components/help/help-hero-image";
import { ownerArticles, customerArticles } from "@/content/help";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

export const metadata: Metadata = {
  title: "Help Center & Guides — MenuMinute",
  description:
    "Explore friendly, step-by-step guides for restaurant owners, kitchen teams, and dining guests. Learn how to craft digital menus, print permanent table QR codes, run Kitchen Pro, and browse effortlessly.",
  openGraph: {
    title: "MenuMinute Help Center & Restaurant Guides",
    description: "Clear, non-technical guides for restaurant owners, kitchen teams, and diners.",
    type: "website",
  },
};

export default function HelpCenterPage() {
  const popularOwnerGuides = ownerArticles.slice(0, 4);
  const popularCustomerGuides = customerArticles.slice(0, 3);

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />

      {/* Hero Section matching Pricing & Marketing Subpages */}
      <section className="relative overflow-hidden border-b border-stone-200/80 bg-gradient-to-b from-orange-500/10 via-stone-50 to-stone-50 px-4 pt-16 pb-20 text-center sm:px-6 lg:px-8 dark:border-stone-800 dark:from-orange-950/20 dark:via-stone-950 dark:to-stone-950">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3.5 py-1 text-xs font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
            <Sparkles className="size-3.5" />
            <span>MenuMinute Knowledge Base · Friendly Guides for Real Restaurants</span>
          </div>

          <h1 className="font-display text-foreground text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            How can we help your <em>restaurant</em> today?
          </h1>

          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            Illustrated step-by-step guides written for busy restaurant operators, head chefs, and
            dining guests. No technical jargon—just clear hospitality workflows.
          </p>

          <div className="mt-8">
            <HelpSearch />
          </div>

          {/* Hero Visual Placeholder Card */}
          <div className="mx-auto mt-12 max-w-3xl">
            <HelpHeroImage
              src="/brand/qr-studio/tabletop-press/hero-desktop-light.webp"
              alt="MenuMinute permanent tabletop QR codes and digital menu display"
              badge="Illustrative product artwork"
              caption="Permanent tabletop QR stickers ensure your menus stay live forever without ever re-printing."
            />
          </div>
        </div>
      </section>

      {/* Audience Track Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Track 1: Restaurant Owners */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-orange-200/80 bg-gradient-to-br from-white via-orange-50/20 to-orange-100/10 p-8 shadow-sm transition hover:shadow-md dark:border-orange-900/50 dark:from-stone-900 dark:via-stone-900 dark:to-orange-950/20">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm">
                <Store className="size-6" />
              </div>
              <h2 className="font-display mt-5 text-2xl font-bold text-stone-900 dark:text-stone-100">
                For Restaurant Owners &amp; Staff
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                From drafting your digital menu to managing live orders, table QR stickers, and
                Kitchen Pro station displays.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-stone-600 dark:text-stone-400">
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Menu Studio
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  QR Studio
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Kitchen Pro
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Dish Availability
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  POS Receipts
                </span>
              </div>
            </div>
            <div className="mt-8 pt-4">
              <Link
                href="/help/owner"
                className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700"
              >
                Browse All 10 Owner Guides <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>

          {/* Track 2: Diners & Guests */}
          <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/20 to-emerald-100/10 p-8 shadow-sm transition hover:shadow-md dark:border-emerald-900/50 dark:from-stone-900 dark:via-stone-900 dark:to-emerald-950/20">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
                <Utensils className="size-6" />
              </div>
              <h2 className="font-display mt-5 text-2xl font-bold text-stone-900 dark:text-stone-100">
                For Diners &amp; Guests
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                How to scan table QR codes, filter dishes by diet or allergens, customize items, and
                track meal preparation.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-stone-600 dark:text-stone-400">
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Camera Scanning
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Dietary Filters
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Live Tracker
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Call Waiter
                </span>
                <span className="rounded-lg border border-stone-200/80 bg-white px-2.5 py-1 shadow-xs dark:border-stone-800 dark:bg-stone-800">
                  Safe Offline
                </span>
              </div>
            </div>
            <div className="mt-8 pt-4">
              <Link
                href="/help/customer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Browse All 6 Guest Guides <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Owner Guides Grid */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 dark:border-stone-800">
          <div>
            <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Essential Restaurant Guides
            </h3>
            <p className="text-xs text-stone-500">
              Core workflows to get your digital restaurant running smoothly
            </p>
          </div>
          <Link
            href="/help/owner"
            className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:underline dark:text-orange-400"
          >
            View all 10 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {popularOwnerGuides.map((article) => (
            <HelpCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* Featured Diner Guides Grid */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between border-b border-stone-200/80 pb-4 dark:border-stone-800">
          <div>
            <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Diner &amp; Guest Guides
            </h3>
            <p className="text-xs text-stone-500">
              Fast, friendly tips for guests scanning digital QR menus
            </p>
          </div>
          <Link
            href="/help/customer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
          >
            View all 6 <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {popularCustomerGuides.map((article) => (
            <HelpCard key={article.id} article={article} />
          ))}
        </div>
      </section>

      {/* FAQ Banner */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-stone-200/80 bg-white p-8 shadow-sm sm:flex-row dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
              <HelpCircle className="size-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Have a quick question?
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Explore our searchable list of frequently asked questions covering pricing, QR
                printing, and hardware.
              </p>
            </div>
          </div>
          <Link
            href="/help/faq"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-stone-300 bg-stone-50 px-5 py-2.5 text-xs font-bold text-stone-800 shadow-sm transition hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
          >
            Open FAQ Directory <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
