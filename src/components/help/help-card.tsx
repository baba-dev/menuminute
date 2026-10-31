import React from "react";
import Link from "next/link";
import { Clock, ArrowRight } from "lucide-react";
import type { HelpArticle } from "@/content/help/contracts";

interface HelpCardProps {
  article: HelpArticle;
}

export function HelpCard({ article }: HelpCardProps) {
  const isOwner = article.audience === "owner";

  return (
    <Link
      href={`/help/${article.audience}/${article.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-orange-400 hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:border-orange-600"
    >
      <div>
        <div className="flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
              isOwner
                ? "border border-orange-200/80 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300"
                : "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {article.category}
          </span>
          <div className="flex items-center gap-1 text-xs text-stone-600">
            <Clock className="size-3.5" />
            <span>{article.readTimeMinutes} min</span>
          </div>
        </div>

        <h3 className="font-display mt-3 text-base font-bold text-stone-900 transition-colors group-hover:text-orange-700 dark:text-stone-100 dark:group-hover:text-orange-400">
          {article.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
          {article.summary}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
        <span className="text-xs font-semibold text-orange-700 group-hover:underline dark:text-orange-400">
          Read Guide
        </span>
        <ArrowRight className="size-4 text-stone-300 transition-transform group-hover:translate-x-1 group-hover:text-orange-700 dark:text-stone-600 dark:group-hover:text-orange-400" />
      </div>
    </Link>
  );
}
