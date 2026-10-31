"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface HelpFeedbackProps {
  articleTitle: string;
}

export function HelpFeedback({ articleTitle }: HelpFeedbackProps) {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  const handleVote = (vote: "yes" | "no") => {
    setVoted(vote);
    if (vote === "yes") {
      toast.success("Thank you for your feedback!", {
        description: "We are glad this guide helped your restaurant.",
      });
    } else {
      toast.info("Thank you for letting us know.", {
        description: "Our hospitality team continuously updates and improves our guides.",
      });
    }
  };

  return (
    <section
      aria-label="Article feedback"
      className="my-10 rounded-2xl border border-stone-200/80 bg-gradient-to-br from-white to-stone-50/60 p-6 text-center shadow-sm dark:border-stone-800 dark:from-stone-900 dark:to-stone-950/60"
    >
      {voted === null ? (
        <div>
          <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            Was this guide helpful for your team?
          </h4>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Your feedback helps us refine instructions for thousands of restaurant operators and
            diners.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => handleVote("yes")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
            >
              <ThumbsUp className="size-3.5 text-emerald-600" />
              <span>Yes, it helped!</span>
            </button>
            <button
              type="button"
              onClick={() => handleVote("no")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:border-stone-400 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              <ThumbsDown className="size-3.5 text-stone-400" />
              <span>Could be clearer</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-5" />
          </div>
          <p className="mt-2 text-sm font-bold text-stone-900 dark:text-stone-100">
            {voted === "yes" ? "Thanks for your feedback!" : "Thank you for helping us improve!"}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Need real-time answers for &ldquo;{articleTitle}&rdquo;? Chat with Ember AI in your
            dashboard or explore our{" "}
            <Link href="/help/faq" className="text-orange-600 underline hover:text-orange-700">
              FAQs
            </Link>
            .
          </p>
        </div>
      )}
    </section>
  );
}
