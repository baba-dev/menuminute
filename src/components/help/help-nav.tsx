import React from "react";
import Link from "next/link";
import { ChevronRight, Home, ArrowLeft } from "lucide-react";
import { BrandNavLogo } from "@/components/marketing/brand/brand-nav-logo";
import { ThemeControl } from "@/components/menu-product/theme-control";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HelpHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  backLink?: { label: string; href: string };
}

export function HelpHeader({ breadcrumbs, backLink }: HelpHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="MenuMinute Home">
            <BrandNavLogo />
          </Link>
          <span className="hidden text-stone-300 sm:inline">|</span>
          <Link
            href="/help"
            className="hidden text-sm font-bold text-stone-700 hover:text-amber-600 sm:inline dark:text-stone-300"
          >
            Help &amp; Guides
          </Link>
        </div>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumbs"
            className="hidden items-center gap-1.5 text-xs text-stone-500 md:flex"
          >
            <Link href="/help" className="hover:text-stone-900 dark:hover:text-stone-200">
              <Home className="size-3.5" />
            </Link>
            {breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.label}>
                <ChevronRight className="size-3 text-stone-400" />
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-stone-900 dark:hover:text-stone-200"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {backLink && (
            <Link
              href={backLink.href}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
            >
              <ArrowLeft className="size-3.5" />
              <span>{backLink.label}</span>
            </Link>
          )}
          <Link
            href="/demo"
            className="hidden text-xs font-semibold text-stone-600 hover:text-stone-900 sm:inline dark:text-stone-400 dark:hover:text-stone-200"
          >
            Try Demo
          </Link>
          <ThemeControl />
        </div>
      </div>
    </header>
  );
}
