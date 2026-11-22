import { allFoodPreviews } from "./pilot";
import { cleanFoodQuery, type FoodEntry, type FoodKind } from "./contracts";

/** Lightweight bounded public search. Upgrade to PostgreSQL FTS only with reviewed content. */
function normalized(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
const synonyms: Record<string, string> = {
  "पनीर": "paneer",
  "टिक्का": "tikka",
  "बिरयानी": "biryani",
  "समोसा": "samosa",
  "डोसा": "dosa",
  "रोटी": "roti",
  "मसाला": "masala",
};
function queryTokens(raw: string): string[] {
  return normalized(raw)
    .split(" ")
    .filter((token) => token.length > 1)
    .map((token) => synonyms[token] ?? token)
    .slice(0, 12);
}
export type FoodSearchResult = { entry: FoodEntry; score: number };
export function searchFood(rawQuery: string | undefined, kind?: FoodKind, limit = 24): FoodSearchResult[] {
  const query = cleanFoodQuery(rawQuery);
  const tokens = queryTokens(query);
  if (!tokens.length) return [];
  const phrase = tokens.join(" ");
  const results = allFoodPreviews()
    .filter((entry) => !kind || entry.kind === kind)
    .map((entry) => {
      const name = normalized(entry.title);
      const aliases = entry.aliases.map(normalized);
      const head = normalized(entry.description + " " + entry.eyebrow);
      const paragraphs = normalized(entry.sections.map((section) => section.title).join(" "));
      let score = 0;
      if (name === phrase || aliases.includes(phrase)) score += 110;
      else if (name.startsWith(phrase) || aliases.some((alias) => alias.startsWith(phrase))) score += 75;
      else if (name.includes(phrase)) score += 35;
      for (const token of tokens) {
        const inName = name.split(" ").some((word) => word.startsWith(token));
        const inAlias = aliases.some((alias) => alias.includes(token));
        const inDescription = head.includes(token);
        const inSection = paragraphs.includes(token);
        if (inName) score += 30;
        else if (inAlias) score += 23;
        else if (inDescription) score += 9;
        else if (inSection) score += 3;
      }
      return { entry, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return results.slice(0, Math.min(24, Math.max(0, limit)));
}
export function browseFood(kind?: FoodKind): FoodEntry[] {
  return allFoodPreviews()
    .filter((entry) => !kind || entry.kind === kind)
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title));
}
