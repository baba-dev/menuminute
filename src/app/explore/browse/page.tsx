import type { Metadata } from "next";
import Link from "next/link";
import { AtlasEmptyState, AtlasFoodCard, AtlasSearchForm } from "@/components/encyclopedia/atlas";
import { foodKinds, type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { browseFood } from "@/modules/food-encyclopedia/search";
import { publishedFoodEntries } from "@/modules/food-encyclopedia/pilot";

export const metadata: Metadata = {
  title: "Browse the Food Encyclopedia",
  description: "Browse MenuMinute's dish, ingredient, cuisine, comparison and food-term guides.",
  alternates: { canonical: "/explore/browse" },
  robots: { index: publishedFoodEntries.length > 0, follow: true },
};
const filters = [
  { label: "All topics", kind: "" },
  { label: "Dishes", kind: "dishes" },
  { label: "Ingredients", kind: "ingredients" },
  { label: "Cuisines", kind: "cuisines" },
  { label: "Terms", kind: "terms" },
  { label: "Comparisons", kind: "compare" },
];
export default async function AtlasBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const input = (await searchParams).kind;
  const kind: FoodKind | undefined = foodKinds.find((value) => value === input);
  const entries = browseFood(kind);
  return (
    <main id="atlas-main" className="atlas-wrap">
      <section className="atlas-page-intro">
        <span className="atlas-kicker">THE COLLECTION / DISCOVER</span>
        <h1>
          Find your next
          <br />
          food curiosity.
        </h1>
        <p>
          A growing reference to the dishes, ingredients, cuisines and menu terminology worth
          knowing.
        </p>
      </section>
      <AtlasSearchForm compact />
      <nav className="atlas-filter-nav" aria-label="Filter food topics">
        {filters.map((filter) => (
          <Link
            key={filter.label}
            href={filter.kind ? "/explore/browse?kind=" + filter.kind : "/explore/browse"}
            aria-current={(kind ?? "") === filter.kind ? "page" : undefined}
            className="atlas-filter"
          >
            {filter.label}
          </Link>
        ))}
      </nav>
      <p className="atlas-result-summary">{entries.length} available design-preview guides</p>
      {entries.length ? (
        <div className="atlas-card-grid">
          {entries.map((entry) => (
            <AtlasFoodCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <AtlasEmptyState
          title="More food stories are being prepared."
          description="This section will appear as reviewed editorial guides become available."
        />
      )}
    </main>
  );
}
