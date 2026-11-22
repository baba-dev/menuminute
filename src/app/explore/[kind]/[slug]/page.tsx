import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  AtlasArt, AtlasArticleHero, AtlasArticleSections, AtlasBreadcrumbs, AtlasFacts, AtlasFoodCard,
  AtlasPreviewNotice, AtlasSectionHeading,
} from "@/components/encyclopedia/atlas";
import { foodKinds, foodPath, isEditoriallyIndexable, type FoodEntry, type FoodKind } from "@/modules/food-encyclopedia/contracts";
import { allFoodPreviews, getFoodEntry, getRelatedFood } from "@/modules/food-encyclopedia/pilot";
import { safeJsonLd, PUBLIC_ORIGIN } from "@/lib/marketing/seo";

type PageParams = Promise<{ kind: string; slug: string }>;
function resolve(kind: string, slug: string): FoodEntry | undefined {
  if (!foodKinds.some((value) => value === kind)) return undefined;
  return getFoodEntry(kind as FoodKind, slug);
}
export function generateStaticParams() {
  return allFoodPreviews().map(({ kind, slug }) => ({ kind, slug }));
}
export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { kind, slug } = await params;
  const entry = resolve(kind, slug);
  if (!entry) return { title: "Food guide not found", robots: { index: false, follow: false } };
  const path = foodPath(entry);
  const indexable = isEditoriallyIndexable(entry);
  return {
    title: entry.title,
    description: entry.description,
    alternates: { canonical: path },
    robots: { index: indexable, follow: true },
    openGraph: {
      title: entry.title + " — Food Encyclopedia",
      description: entry.description,
      url: PUBLIC_ORIGIN + path,
      type: "article",
      images: entry.imagePath ? [{ url: entry.imagePath, alt: entry.imageAlt ?? entry.title }] : undefined,
    },
  };
}
export default async function AtlasFoodEntryPage({ params }: { params: PageParams }) {
  const { kind, slug } = await params;
  const entry = resolve(kind, slug);
  if (!entry || entry.status === "archived") notFound();
  const indexable = isEditoriallyIndexable(entry);
  const related = getRelatedFood(entry, 3);
  return <main id="atlas-main" className="atlas-wrap">
    {indexable && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
      "@context": "https://schema.org", "@type": "Article",
      headline: entry.title, description: entry.description,
      datePublished: entry.publishedAt, dateModified: entry.reviewedAt,
      publisher: { "@type": "Organization", name: "MenuMinute" },
      mainEntityOfPage: PUBLIC_ORIGIN + foodPath(entry),
    }) }} />}
    <AtlasBreadcrumbs items={[
      { label: kind === "compare" ? "Comparisons" : kind.charAt(0).toUpperCase() + kind.slice(1), href: "/explore/browse?kind=" + kind },
      { label: entry.title },
    ]} />
    {!indexable && <AtlasPreviewNotice />}
    <AtlasArticleHero entry={entry} />
    <AtlasFacts entry={entry} />
    {kind === "compare" && <div className="atlas-compare-grid" aria-label="Naan and roti side by side">
      <div className="atlas-compare-panel"><AtlasArt entry={entry} /><div>
        <span className="atlas-kicker">01 / THE OFTEN LEAVENED BREAD</span><h2>Naan</h2>
        <p>Often made with leavening, cooked at high heat, and associated with tandoor cooking.</p></div></div>
      <div className="atlas-compare-panel"><div className="atlas-art atlas-art-sage"><div className="atlas-art-fallback">ROTI / TAWA FLATBREAD</div></div><div>
        <span className="atlas-kicker">02 / THE EVERYDAY FLATBREAD</span><h2>Roti</h2>
        <p>Typically an unleavened flatbread, commonly cooked on a tawa or griddle.</p></div></div>
    </div>}
    <AtlasArticleSections entry={entry} />
    {kind === "cuisines" && related.length > 0 && <section className="atlas-content-section">
      <AtlasSectionHeading kicker="REGIONAL DISCOVERY" title="Dishes and flavors to explore."
        description="Continue into familiar dishes and related ingredients." />
      <div className="atlas-card-grid">{related.map((candidate) => <AtlasFoodCard key={candidate.id} entry={candidate} />)}</div>
    </section>}
    {kind === "ingredients" && related.length > 0 && <section className="atlas-content-section">
      <AtlasSectionHeading kicker="RELATED FOOD KNOWLEDGE" title="Where flavor connects."
        description="Explore dishes and traditions linked to this ingredient." />
      <div className="atlas-card-grid">{related.map((candidate) => <AtlasFoodCard key={candidate.id} entry={candidate} />)}</div>
    </section>}
    <div style={{ paddingTop: 36 }}><Link href="/explore/browse" className="atlas-more-link">Explore more food guides <ArrowRight size={19} aria-hidden="true" /></Link></div>
  </main>;
}
