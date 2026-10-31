import { ownerArticles } from "./owner-articles";
import { customerArticles } from "./customer-articles";
import { allFaqs } from "./faqs";
import type { HelpArticle, Audience, HelpFaqItem } from "./contracts";

export * from "./contracts";
export { ownerArticles } from "./owner-articles";
export { customerArticles } from "./customer-articles";
export { allFaqs } from "./faqs";

export const allArticles: HelpArticle[] = [...ownerArticles, ...customerArticles];

/** Find an article by slug regardless of audience */
export function getArticleBySlug(slug: string): HelpArticle | undefined {
  return allArticles.find((a) => a.slug === slug);
}

/** Get all articles for a specific audience */
export function getArticlesByAudience(audience: Audience): HelpArticle[] {
  if (audience === "both") return allArticles;
  return allArticles.filter((a) => a.audience === audience || a.audience === "both");
}

/** Get all unique categories for an audience */
export function getCategories(audience?: Audience): string[] {
  const articles = audience ? getArticlesByAudience(audience) : allArticles;
  const categories = new Set(articles.map((a) => a.category));
  return Array.from(categories);
}

/** Get related articles for a given article */
export function getRelatedArticles(article: HelpArticle): HelpArticle[] {
  return article.relatedArticleSlugs
    .map((slug) => getArticleBySlug(slug))
    .filter((a): a is HelpArticle => Boolean(a));
}

export interface SearchResult {
  article: HelpArticle;
  matchedField: "title" | "summary" | "keyword" | "quickStep" | "faq";
  snippet: string;
}

/** Fast, zero-dependency client/server search across articles */
export function searchHelpArticles(query: string, audience?: Audience): SearchResult[] {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const candidates = audience ? getArticlesByAudience(audience) : allArticles;
  const results: SearchResult[] = [];

  for (const article of candidates) {
    // 1. Match title
    if (article.title.toLowerCase().includes(clean)) {
      results.push({
        article,
        matchedField: "title",
        snippet: article.summary,
      });
      continue;
    }

    // 2. Match keywords
    if (article.keywords.some((k) => k.toLowerCase().includes(clean))) {
      results.push({
        article,
        matchedField: "keyword",
        snippet: article.summary,
      });
      continue;
    }

    // 3. Match quick steps
    const stepMatch = article.quickSteps.find((step) => step.toLowerCase().includes(clean));
    if (stepMatch) {
      results.push({
        article,
        matchedField: "quickStep",
        snippet: stepMatch,
      });
      continue;
    }

    // 4. Match summary or subtitle
    if (
      article.summary.toLowerCase().includes(clean) ||
      article.subtitle.toLowerCase().includes(clean)
    ) {
      results.push({
        article,
        matchedField: "summary",
        snippet: article.summary,
      });
      continue;
    }

    // 5. Match FAQs
    const faqMatch = article.faqs.find(
      (f) => f.question.toLowerCase().includes(clean) || f.answer.toLowerCase().includes(clean)
    );
    if (faqMatch) {
      results.push({
        article,
        matchedField: "faq",
        snippet: `Q: ${faqMatch.question}`,
      });
    }
  }

  return results;
}

/** Search FAQs directly */
export function searchFaqs(query: string): HelpFaqItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return allFaqs;
  return allFaqs.filter(
    (f) =>
      f.question.toLowerCase().includes(clean) ||
      f.answer.toLowerCase().includes(clean) ||
      (f.category && f.category.toLowerCase().includes(clean))
  );
}
