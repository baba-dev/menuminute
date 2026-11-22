import type { Metadata } from "next";
import Link from "next/link";
import { AtlasEmptyState, AtlasFoodCard, AtlasSearchForm } from "@/components/encyclopedia/atlas";
import { cleanFoodQuery, foodKinds, type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { searchFood } from "@/modules/food-encyclopedia/search";

export const metadata: Metadata = {
  title: "Search Food Guides",
  description: "Find practical explanations of dishes, ingredients and cuisines.",
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};
export default async function AtlasSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const params = await searchParams;
  const q = cleanFoodQuery(params.q);
  const kind: FoodKind | undefined = foodKinds.find((value) => value === params.kind);
  const results = searchFood(q, kind);
  return (
    <main id="atlas-main" className="atlas-wrap">
      <section className="atlas-page-intro atlas-search-title">
        <span className="atlas-kicker">SEARCH THE ATLAS</span>
        <h1>What are you curious about?</h1>
        <p>
          Search dish names, common ingredients and culinary terms. You can also try another
          spelling.
        </p>
      </section>
      <AtlasSearchForm defaultValue={q} compact />
      {q && (
        <p className="atlas-result-summary">
          {results.length} {results.length === 1 ? "guide" : "guides"} matching <strong>{q}</strong>
        </p>
      )}
      {q && results.length ? (
        <div className="atlas-card-grid">
          {results.map(({ entry }) => (
            <AtlasFoodCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <AtlasEmptyState
          title={q ? "Nothing matched that search." : "Your next discovery starts with a search."}
          description={
            q
              ? "Try a simpler dish name or browse our curated food topics."
              : "Try paneer tikka, biryani, kasuri methi or masala dosa."
          }
        />
      )}
      <div style={{ marginTop: 32 }}>
        <Link className="atlas-more-link" href="/explore/browse">
          Browse all guides <span aria-hidden="true">→</span>
        </Link>
      </div>
    </main>
  );
}
