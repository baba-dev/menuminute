"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ListFilter, ChevronRight } from "lucide-react";

interface TocSection {
  id: string;
  title: string;
}

interface HelpTocProps {
  sections: TocSection[];
}

export function HelpTableOfContents({ sections }: HelpTocProps) {
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      {
        rootMargin: "-80px 0% -60% 0%",
        threshold: 0,
      }
    );

    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sections]);

  if (!sections.length) return null;

  return (
    <>
      <details className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 lg:hidden">
        <summary className="cursor-pointer select-none text-sm font-semibold text-stone-900 dark:text-stone-100">
          Jump to a section
        </summary>
        <nav aria-label="Article sections" className="mt-3 flex flex-col gap-1">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`#${section.id}`}
              className="flex min-h-11 items-center rounded-lg px-3 text-sm text-stone-700 hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-orange-600 dark:text-stone-200 dark:hover:bg-stone-800"
            >
              {section.title}
            </Link>
          ))}
        </nav>
      </details>
      <aside aria-label="Table of contents" className="hidden lg:block">
      <div className="sticky top-24 rounded-2xl border border-stone-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/80">
        <h4 className="flex items-center gap-2 text-xs font-bold tracking-wider text-stone-900 uppercase dark:text-stone-100">
          <ListFilter className="size-3.5 text-orange-600" />
          <span>On this page</span>
        </h4>
        <nav className="mt-3.5 space-y-1 text-xs">
          {sections.map((section) => {
            const isActive = activeId === section.id;
            return (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? "bg-orange-50 font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                }`}
              >
                <span className="line-clamp-1">{section.title}</span>
                <ChevronRight
                  className={`size-3 shrink-0 transition-transform ${
                    isActive
                      ? "translate-x-0.5 text-orange-600"
                      : "text-transparent group-hover:text-stone-400"
                  }`}
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
    </>
  );
}
