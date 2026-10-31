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

// Search is shared by the public Help Center and Ember. It does not call a model,
// store searches, or depend on the visitor's account.
const stopWords = new Set([
  "how",
  "do",
  "does",
  "did",
  "i",
  "my",
  "me",
  "you",
  "your",
  "the",
  "a",
  "an",
  "to",
  "for",
  "with",
  "of",
  "can",
  "could",
  "is",
  "are",
  "what",
  "where",
  "in",
  "and",
  "on",
  "from",
  "this",
  "that",
  "please",
  "our",
  "it",
  "we",
  "get",
]);
const aliases: Record<string, string[]> = {
  qr: ["qr", "code", "sticker", "scan"],
  scan: ["scan", "qr", "camera"],
  print: ["print", "printing", "download", "sticker", "sheet"],
  sold: ["sold", "unavailable", "availability", "86"],
  unavailable: ["unavailable", "sold", "86"],
  internet: ["internet", "offline", "network", "connection"],
  disconnected: ["disconnected", "offline", "network", "outage"],
  stopped: ["stopped", "outage", "offline", "lost"],
  bill: ["bill", "receipt", "payment", "pay"],
  paid: ["paid", "payment", "recording"],
  cashier: ["cashier", "pos", "counter"],
  kitchen: ["kitchen", "kds", "cook", "station"],
  staff: ["staff", "team", "roles", "invite"],
  waiter: ["waiter", "server", "service"],
  dishes: ["dishes", "dish", "food", "items"],
  dish: ["dish", "dishes", "item"],
  edit: ["edit", "editing", "change", "update"],
  restaurant: ["restaurant", "outlet", "workspace"],
  another: ["another", "multiple", "outlet"],
};
function normalized(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function tokens(query: string): string[] {
  return Array.from(
    new Set(
      normalized(query.slice(0, 200))
        .split(" ")
        .filter((t) => t.length > 1 && !stopWords.has(t))
    )
  ).slice(0, 16);
}
function wordMatch(haystack: Set<string>, token: string): boolean {
  const variants = aliases[token] ?? [token];
  return variants.some(
    (v) =>
      haystack.has(v) ||
      [...haystack].some(
        (word) =>
          word.length > 4 &&
          v.length > 4 &&
          (word.startsWith(v) || v.startsWith(word)) &&
          Math.abs(word.length - v.length) <= 4
      )
  );
}
function scoreFields(query: string, fields: Array<{ text: string; weight: number }>): number {
  const words = tokens(query);
  if (!words.length) return 0;
  const indexed = fields.map(({ text, weight }) => ({
    value: normalized(text),
    words: new Set(normalized(text).split(" ")),
    weight,
  }));
  let score = 0;
  let matched = 0;
  for (const word of words) {
    const best = Math.max(0, ...indexed.map((f) => (wordMatch(f.words, word) ? f.weight : 0)));
    if (best) {
      matched++;
      score += best;
    }
  }
  // Reject results that only happen to mention one unrelated word.
  if (matched < Math.max(1, Math.ceil(words.length / 2))) return 0;
  const phrase = normalized(query);
  if (phrase.length >= 4 && indexed.some((f) => f.value.includes(phrase))) score += 8;
  return score * (matched / words.length);
}
function articleFields(a: HelpArticle): Array<{ text: string; weight: number }> {
  return [
    { text: a.title, weight: 9 },
    { text: a.category, weight: 6 },
    { text: a.keywords.join(" "), weight: 8 },
    { text: a.summary + " " + a.subtitle, weight: 5 },
    { text: a.quickSteps.join(" "), weight: 4 },
    { text: a.sections.map((s) => s.title + " " + s.content.join(" ")).join(" "), weight: 3 },
    { text: a.faqs.map((f) => f.question + " " + f.answer).join(" "), weight: 2 },
  ];
}
// Common restaurant tasks receive a precise guide match before broad terms
// such as "code" or "table" influence the rest of the results.
const taskGuides = [
  { words: ["qr", "print"], slug: "qr-codes-and-tables" },
  { words: ["sold", "dish"], slug: "live-orders-and-service" },
  { words: ["internet", "stopped"], slug: "offline-menu-and-pwa" },
  { words: ["mark", "paid"], slug: "pos-and-payments" },
] as const;

function taskMatchBoost(queryWords: string[], slug: string): number {
  return taskGuides.some(
    (rule) => rule.slug === slug && rule.words.every((word) => queryWords.includes(word))
  )
    ? 60
    : 0;
}

export function searchHelpArticles(query: string, audience?: Audience): SearchResult[] {
  const queryWords = tokens(query);
  if (!queryWords.length) return [];
  return (audience ? getArticlesByAudience(audience) : allArticles)
    .map((article) => ({
      article,
      score: scoreFields(query, articleFields(article)) + taskMatchBoost(queryWords, article.slug),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, 12)
    .map(({ article }): SearchResult => ({
      article,
      matchedField: "title",
      snippet: article.summary,
    }));
}

export function searchFaqs(query: string): HelpFaqItem[] {
  if (!query.trim()) return allFaqs;
  return allFaqs
    .map((faq) => ({
      faq,
      score: scoreFields(query, [
        { text: faq.question, weight: 8 },
        { text: faq.answer, weight: 4 },
        { text: faq.category ?? "", weight: 3 },
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ faq }) => faq);
}
