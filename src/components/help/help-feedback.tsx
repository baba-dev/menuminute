import Link from "next/link";
import { BookOpen, MessageCircleQuestion } from "lucide-react";

// Help pages must not claim to have recorded feedback until there is an
// authenticated or abuse-protected storage endpoint behind that action.
export function HelpFeedback({ articleTitle }: { articleTitle: string }) {
  return (
    <section
      aria-label="More help"
      className="my-10 rounded-2xl border border-stone-200/80 bg-stone-50 p-6 dark:border-stone-800 dark:bg-stone-900"
    >
      <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
        Still have a question?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
        If this guide does not answer your question about {articleTitle}, browse the common
        questions or ask a member of your restaurant team for help.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/help/faq"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          <MessageCircleQuestion size={17} aria-hidden="true" /> Common questions
        </Link>
        <Link
          href="/help"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-white dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          <BookOpen size={17} aria-hidden="true" /> All guides
        </Link>
      </div>
    </section>
  );
}
