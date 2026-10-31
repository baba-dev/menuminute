import React from "react";
import Link from "next/link";
import { ChevronRight, Home, ArrowLeft } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface HelpBreadcrumbsProps {
  items: BreadcrumbItem[];
  backLink?: { label: string; href: string };
}

export function HelpBreadcrumbs({ items, backLink }: HelpBreadcrumbsProps) {
  return (
    <div className="border-b border-stone-200/80 bg-stone-50/60 py-3 dark:border-stone-800 dark:bg-stone-900/40">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Breadcrumb navigation"
          className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500"
        >
          <Link
            href="/help"
            className="inline-flex items-center gap-1 text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
          >
            <Home className="size-3.5" />
            <span className="sr-only">Help Center Home</span>
          </Link>
          {items.map((item) => (
            <React.Fragment key={item.label}>
              <ChevronRight className="size-3 text-stone-400" />
              {item.href ? (
                <Link
                  href={item.href}
                  className="font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {backLink && (
          <Link
            href={backLink.href}
            className="hidden items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-orange-600 sm:inline-flex dark:text-stone-400 dark:hover:text-orange-400"
          >
            <ArrowLeft className="size-3.5" />
            <span>{backLink.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
