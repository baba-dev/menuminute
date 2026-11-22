import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  AtlasArt, AtlasCategoryTiles, AtlasFoodCard, AtlasSearchForm, AtlasSectionHeading,
} from "@/components/encyclopedia/atlas";
import { getFoodEntry, allFoodPreviews, publishedFoodEntries } from "@/modules/food-encyclopedia/pilot";

export const metadata: Metadata = {
  title: "The Atlas — Food Encyclopedia",
  description: "Explore the stories, ingredients, origins and flavors behind popular foods with MenuMinute's visual Food Encyclopedia.",
  alternates: { canonical: "/explore" },
  robots: { index: publishedFoodEntries.length > 0, follow: true },
};

export default function AtlasHomePage() {
  const featured = getFoodEntry("dishes", "paneer-tikka");
  const selected = ["masala-dosa", "biryani", "dal-baati-churma"]
    .flatMap((slug) => allFoodPreviews().filter((entry) => entry.slug === slug));
  return <main id="atlas-main">
    <section className="atlas-hero atlas-wrap">
      <div className="atlas-hero-copy">
        <span className="atlas-kicker">THE ATLAS / FOOD FOR THE CURIOUS</span>
        <h1>Every dish<br />has a <em>story.</em></h1>
        <p className="atlas-hero-lead">The world&apos;s food, explained beautifully. Discover the ingredients, origins, flavors and little details behind what we eat.</p>
        <AtlasSearchForm />
        <div className="atlas-trending"><strong>POPULAR NOW</strong>
          {["Biryani", "Paneer", "Tandoor", "Masala Dosa"].map((name) =>
            <Link className="atlas-topic-link" key={name} href={"/explore/search?q=" + encodeURIComponent(name)}>{name}</Link>)}
        </div>
      </div>
      <div className="atlas-hero-visual" aria-label="Featured dish">
        <span className="atlas-visual-tag">TODAY&apos;S FLAVOR</span>
        {featured && <AtlasArt entry={featured} featured />}
        <div className="atlas-visual-caption">
          <div><h2>Paneer Tikka</h2><p>The smoky classic from North India</p></div>
          <Link href="/explore/dishes/paneer-tikka" className="atlas-counter">DISCOVER ↗</Link>
        </div>
      </div>
    </section>
    <section className="atlas-dark-section">
      <div className="atlas-wrap">
        <span className="atlas-kicker">EXPLORE THE ENCYCLOPEDIA</span>
        <h2>Follow your curiosity.</h2>
        <p>Start with the dish, then explore the ingredients and culture behind it.</p>
        <AtlasCategoryTiles />
      </div>
    </section>
    <section className="atlas-wrap atlas-content-section">
      <AtlasSectionHeading kicker="EDITORIAL DISCOVERY" title="A delicious place to start."
        description="Curated introductions to dishes, food terms and regional traditions."
        action={{ label: "Explore all topics", href: "/explore/browse" }} />
      <div className="atlas-card-grid">{selected.map((entry) => <AtlasFoodCard entry={entry} key={entry.id} />)}</div>
      <div className="atlas-feature-band">
        {featured && <AtlasArt entry={featured} />}
        <div className="atlas-feature-copy">
          <span className="atlas-kicker">ANATOMY OF A DISH</span>
          <h2>More than what&apos;s on the plate.</h2>
          <p>Where did it come from? What goes into it? What should you know before ordering it? Discover the details behind familiar favorites.</p>
          <Link className="atlas-button" href="/explore/dishes/paneer-tikka">Explore Paneer Tikka <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  </main>;
}
