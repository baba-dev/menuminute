import type { Metadata } from "next";
import Link from "next/link";
import { AtlasEmptyState, AtlasFoodCard, AtlasSearchForm } from "@/components/encyclopedia/atlas";
import { cleanFoodQuery, foodKinds, type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { listPublishedFood } from "@/modules/food-encyclopedia/editorial-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Search food guides",
  description: "Search reviewed culinary explanations.",
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};
export default async function AtlasSearch({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; page?: string }>;
}) {
  const p = await searchParams;
  const q = cleanFoodQuery(p.q);
  const kind: FoodKind | undefined = foodKinds.find((k) => k === p.kind);
  const page = Math.min(1000, Math.max(1, Number.parseInt(p.page ?? "1", 10) || 1));
  const results = q ? await listPublishedFood(kind, q, 25, (page - 1) * 24) : [];
  const items = results.slice(0, 24),
    hasNext = results.length === 25;
  return (
    <main id="atlas-main" className="atlas-wrap">
      <section className="atlas-page-intro atlas-search-title">
        <span className="atlas-kicker">SEARCH THE ATLAS</span>
        <h1>What are you curious about?</h1>
        <p>Search reviewed dish names, ingredients and culinary terms.</p>
      </section>
      <AtlasSearchForm defaultValue={q} compact />
      {q && (
        <p className="atlas-result-summary">
          {items.length} reviewed guides matching <strong>{q}</strong>
        </p>
      )}
      {items.length ? (
        <div className="atlas-card-grid">
          {items.map((e) => (
            <AtlasFoodCard key={e.id} entry={e} />
          ))}
        </div>
      ) : (
        <AtlasEmptyState
          title={
            q
              ? "No reviewed guide matched your search."
              : "Your next discovery starts with a search."
          }
          description="Try another food name or browse the published encyclopedia."
        />
      )}
      <nav aria-label="Search results pages" className="atlas-filter-nav" style={{ marginTop: 35 }}>
        {page > 1 && (
          <Link
            className="atlas-filter"
            href={"/explore/search?q=" + encodeURIComponent(q) + "&page=" + (page - 1)}
          >
            Previous
          </Link>
        )}
        {hasNext && (
          <Link
            className="atlas-filter"
            href={"/explore/search?q=" + encodeURIComponent(q) + "&page=" + (page + 1)}
          >
            Next
          </Link>
        )}
      </nav>
    </main>
  );
}
