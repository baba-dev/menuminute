import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AtlasArt,
  AtlasCategoryTiles,
  AtlasFoodCard,
  AtlasSearchForm,
  AtlasSectionHeading,
} from "@/components/encyclopedia/atlas";
import { getFoodEntry } from "@/modules/food-encyclopedia/pilot";
import { listPublishedFood } from "@/modules/food-encyclopedia/editorial-service";
import { foodPath } from "@/modules/food-encyclopedia/contracts";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const published = await listPublishedFood(undefined, undefined, 1);
  return {
    title: "The Atlas — Food Encyclopedia",
    description:
      "Explore researched explanations of popular dishes, ingredients, cuisines and culinary terminology.",
    alternates: { canonical: "/explore" },
    robots: { index: published.length > 0, follow: true },
  };
}
export default async function AtlasHomePage() {
  const published = await listPublishedFood(undefined, undefined, 6);
  const featured = published[0] ?? getFoodEntry("dishes", "paneer-tikka");
  const selected = published.slice(0, 3);
  return (
    <main id="atlas-main">
      <section className="atlas-hero atlas-wrap">
        <div className="atlas-hero-copy">
          <span className="atlas-kicker">THE ATLAS / FOOD FOR THE CURIOUS</span>
          <h1>
            Every dish
            <br />
            has a <em>story.</em>
          </h1>
          <p className="atlas-hero-lead">
            The world&apos;s food, explained beautifully. Discover the ingredients, origins, flavors
            and little details behind what we eat.
          </p>
          <AtlasSearchForm />
          <div className="atlas-trending">
            <strong>EXPLORE</strong>
            {["Biryani", "Paneer", "Tandoor", "Masala Dosa"].map((x) => (
              <Link
                key={x}
                className="atlas-topic-link"
                href={"/explore/search?q=" + encodeURIComponent(x)}
              >
                {x}
              </Link>
            ))}
          </div>
        </div>
        <div className="atlas-hero-visual" aria-label="Food discovery illustration">
          <span className="atlas-visual-tag">
            {published.length ? "FEATURED GUIDE" : "EDITORIAL LIBRARY IN PREPARATION"}
          </span>
          {featured && <AtlasArt entry={featured} featured />}
          <div className="atlas-visual-caption">
            <div>
              <h2>{featured?.title ?? "Explore Food"}</h2>
              <p>
                {published.length
                  ? "Learn the story behind the dish"
                  : "Researched guides will appear after editorial approval"}
              </p>
            </div>
            {published.length && featured ? (
              <Link className="atlas-counter" href={foodPath(featured)}>
                DISCOVER ↗
              </Link>
            ) : null}
          </div>
        </div>
      </section>
      <section className="atlas-dark-section">
        <div className="atlas-wrap">
          <span className="atlas-kicker">EXPLORE THE ENCYCLOPEDIA</span>
          <h2>Follow your curiosity.</h2>
          <p>Start with a dish, then explore its ingredients and the culture behind it.</p>
          <AtlasCategoryTiles />
        </div>
      </section>
      <section className="atlas-wrap atlas-content-section">
        <AtlasSectionHeading
          kicker="EDITORIAL DISCOVERY"
          title="A delicious place to start."
          description={
            selected.length
              ? "Independently reviewed articles about food and culture."
              : "The first researched articles are being reviewed. You can explore the Atlas as new guides are approved."
          }
          action={{ label: "Browse the library", href: "/explore/browse" }}
        />
        {selected.length ? (
          <div className="atlas-card-grid">
            {selected.map((e) => (
              <AtlasFoodCard key={e.id} entry={e} />
            ))}
          </div>
        ) : (
          <div className="atlas-empty-state">
            <h2>Our first food stories are in preparation.</h2>
            <p>
              Every published guide will include sources, review information and practical
              explanations.
            </p>
            <Link href="/explore/browse" className="atlas-button">
              Visit the collection <ArrowRight size={18} />
            </Link>
          </div>
        )}
        <div className="atlas-feature-band">
          {featured && <AtlasArt entry={featured} />}
          <div className="atlas-feature-copy">
            <span className="atlas-kicker">ANATOMY OF A DISH</span>
            <h2>More than what&apos;s on the plate.</h2>
            <p>
              Learn where foods come from, what they commonly contain, and what to ask before
              ordering.
            </p>
            <Link className="atlas-button" href="/explore/browse">
              Browse researched guides <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
