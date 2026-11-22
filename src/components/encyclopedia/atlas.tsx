import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpenText, ChevronRight, Leaf, Menu, Search, ShieldAlert, Sparkles } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { foodPath, type FoodEntry } from "@/modules/food-encyclopedia/contracts";
import { getRelatedFood } from "@/modules/food-encyclopedia/pilot";
import { showFoodAdDesignReservation } from "@/modules/food-encyclopedia/ads";

export function AtlasHeader() {
  const items = [
    { label: "Explore", href: "/explore" },
    { label: "Dishes", href: "/explore/browse?kind=dishes" },
    { label: "Ingredients", href: "/explore/browse?kind=ingredients" },
    { label: "Cuisines", href: "/explore/browse?kind=cuisines" },
    { label: "Glossary", href: "/explore/browse?kind=terms" },
  ];
  return (
    <header className="atlas-header atlas-wrap">
      <Link href="/explore" className="atlas-brand" aria-label="MenuMinute Food Encyclopedia home">
        <span className="atlas-brand-main">MenuMinute</span>
        <span className="atlas-brand-divider" aria-hidden="true" />
        <span className="atlas-brand-sub">FOOD ENCYCLOPEDIA</span>
      </Link>
      <nav aria-label="Encyclopedia" className="atlas-desktop-nav">
        {items.map((item) => <Link href={item.href} key={item.label}>{item.label}</Link>)}
      </nav>
      <div className="atlas-header-actions">
        <div className="atlas-theme-switch"><ThemeControl /></div>
        <Link href="/register" className="atlas-nav-cta">For restaurants</Link>
      </div>
      <details className="atlas-mobile-nav">
        <summary aria-label="Open encyclopedia navigation"><Menu size={22} aria-hidden="true" /><span>Menu</span></summary>
        <nav aria-label="Mobile encyclopedia">
          {items.map((item) => <Link href={item.href} key={item.label}>{item.label}<ChevronRight size={17} aria-hidden="true" /></Link>)}
          <Link href="/register">Create a free QR menu <ArrowRight size={17} aria-hidden="true" /></Link>
        </nav>
      </details>
    </header>
  );
}
export function AtlasFooter() {
  return (
    <footer className="atlas-footer">
      <div className="atlas-wrap">
        <div className="atlas-footer-grid">
          <div>
            <p className="atlas-kicker">THE ATLAS BY MENUMINUTE</p>
            <h2>Great food deserves a beautiful first impression.</h2>
            <p>Curious about food? Explore our practical guides. Running a restaurant? Make your menu beautifully digital.</p>
          </div>
          <div>
            <h3>Read and discover</h3>
            <Link href="/explore">Encyclopedia</Link>
            <Link href="/explore/browse">Browse all guides</Link>
            <Link href="/explore/browse?kind=ingredients">Ingredients</Link>
            <Link href="/explore/browse?kind=cuisines">Cuisines</Link>
          </div>
          <div>
            <h3>MenuMinute</h3>
            <Link href="/register">Create your free menu</Link>
            <Link href="/pricing">Plans and pricing</Link>
            <Link href="/about">About us</Link>
            <Link href="/privacy">Privacy policy</Link>
            <Link href="/cookies">Cookie policy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
        <div className="atlas-footer-bottom"><span>© 2026 MenuMinute · A subsidiary of BabaBuilds</span><span>Food knowledge for the curious.</span></div>
      </div>
    </footer>
  );
}
export function AtlasSearchForm({ defaultValue = "", compact = false }: { defaultValue?: string; compact?: boolean }) {
  return (
    <form action="/explore/search" method="GET" role="search" className={"atlas-search " + (compact ? "atlas-search-compact" : "")}>
      <Search size={19} aria-hidden="true" className="atlas-search-icon" />
      <label htmlFor={compact ? "atlas-search-compact" : "atlas-search-main"} className="sr-only">Search food guides</label>
      <input id={compact ? "atlas-search-compact" : "atlas-search-main"} name="q" type="search"
        maxLength={100} placeholder="Search dishes, ingredients, cuisines..." defaultValue={defaultValue} />
      <button type="submit" aria-label="Search the encyclopedia"><ArrowRight size={23} aria-hidden="true" /></button>
    </form>
  );
}
export function AtlasPreviewNotice() {
  return <div className="atlas-preview-notice" role="note"><BookOpenText size={18} aria-hidden="true" />
    <span><strong>Editorial preview.</strong> This example guide illustrates the Atlas design. It has not completed independent fact-checking and is not indexed for search.</span>
  </div>;
}
export function AtlasArt({ entry, featured = false }: { entry: FoodEntry; featured?: boolean }) {
  return <div className={"atlas-art atlas-art-" + entry.tint + (featured ? " atlas-art-featured" : "")}>
    <span className="atlas-art-orbit" aria-hidden="true" />
    {entry.imagePath ? (
      <Image src={entry.imagePath} alt={entry.imageAlt ?? entry.title} width={680} height={680}
        priority={featured} sizes={featured ? "(max-width: 720px) 90vw, 42vw" : "(max-width: 720px) 95vw, 30vw"}
        className="atlas-food-illustration" />
    ) : (
      <div className="atlas-art-fallback"><Leaf size={72} strokeWidth={1.2} aria-hidden="true" /><span>INGREDIENT STUDY</span></div>
    )}
  </div>;
}
export function AtlasFoodCard({ entry }: { entry: FoodEntry }) {
  return <Link href={foodPath(entry)} className="atlas-food-card">
    <AtlasArt entry={entry} />
    <div className="atlas-food-card-info">
      <span className="atlas-kicker">{entry.eyebrow}</span>
      <span className="atlas-card-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
      <h3>{entry.title}</h3><p>{entry.description}</p>
    </div>
  </Link>;
}
export function AtlasCategoryTiles() {
  const categories = [
    { label: "Dishes", description: "The foods we love", href: "/explore/browse?kind=dishes", color: "peach" },
    { label: "Ingredients", description: "What's inside?", href: "/explore/browse?kind=ingredients", color: "sage" },
    { label: "Cuisines", description: "Places through food", href: "/explore/browse?kind=cuisines", color: "blue" },
    { label: "Food terms", description: "Decode any menu", href: "/explore/browse?kind=terms", color: "lavender" },
  ];
  return <div className="atlas-category-tiles">{categories.map((item, index) => (
    <Link key={item.label} href={item.href} className={"atlas-category-tile atlas-art-" + item.color}>
      <span className="atlas-small-label">{"0" + (index + 1)} / EXPLORE</span>
      <span><strong>{item.label}</strong><small>{item.description}</small></span><ArrowRight size={20} aria-hidden="true" />
    </Link>
  ))}</div>;
}
export function AtlasBreadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav aria-label="Breadcrumb" className="atlas-breadcrumb"><Link href="/explore">Explore</Link>
    {items.map((item, index) => <span key={index}><ChevronRight size={13} aria-hidden="true" />
      {item.href ? <Link href={item.href}>{item.label}</Link> : <span aria-current="page">{item.label}</span>}
    </span>)}
  </nav>;
}
export function AtlasFacts({ entry }: { entry: FoodEntry }) {
  return <div className="atlas-facts" aria-label="At a glance">{entry.facts.map((fact) =>
    <div key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>;
}
export function AtlasArticleCTA() {
  return <div className="atlas-owner-cta"><div><span className="atlas-kicker">MADE FOR RESTAURANTS TOO</span>
    <h3>Make your menu just as easy to understand.</h3></div><Link className="atlas-button" href="/register">Create free menu <ArrowRight size={19} aria-hidden="true" /></Link></div>;
}
export function AtlasAdReservation({ kind }: { kind: "inline" | "sidebar" | "horizontal" }) {
  // A design-only geometry preview; no ads, cookies, network calls or empty space in production.
  if (!showFoodAdDesignReservation()) return null;
  return <div className={"atlas-ad-reservation atlas-ad-" + kind} aria-label="Advertising layout preview only">
    <span>ADVERTISEMENT</span><p>Reserved layout geometry · no ad served</p></div>;
}
export function AtlasArticleSections({ entry }: { entry: FoodEntry }) {
  return <div className="atlas-article-layout">
    <nav className="atlas-article-toc" aria-label="On this page">
      <span className="atlas-kicker">ON THIS PAGE</span>
      {entry.sections.map((section, index) => <a href={"#" + section.id} key={section.id}>
        <span>{String(index + 1).padStart(2, "0")}</span> {section.title}</a>)}
    </nav>
    <article className="atlas-article-copy">
      {entry.sections.map((section, index) => <section key={section.id} id={section.id} className="atlas-prose-section">
        <span className="atlas-kicker">{section.eyebrow}</span><h2>{section.title}</h2>
        {section.body.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        {index === 0 && <AtlasAdReservation kind="inline" />}
        {index === 2 && <AtlasAdReservation kind="inline" />}
      </section>)}
      {entry.caution && <aside className="atlas-safety-note" aria-label="Ingredient and allergen information">
        <div><ShieldAlert size={20} aria-hidden="true" /><strong>Ingredients and allergen information</strong></div>
        <p>{entry.caution}</p>
      </aside>}
      <p className="atlas-source-note">Editorial demonstration only. Food preparation varies; no claim describes a specific restaurant serving.</p>
      <AtlasArticleCTA />
    </article>
    <aside className="atlas-article-aside" aria-label="Related reading">
      <div className="atlas-aside-card"><span className="atlas-kicker">KEEP EXPLORING</span><h3>Follow your curiosity.</h3>
        {getRelatedFood(entry).map((related) => <Link key={related.id} href={foodPath(related)}>
          {related.title}<ArrowRight size={16} aria-hidden="true" /></Link>)}
      </div>
      <AtlasAdReservation kind="sidebar" />
    </aside>
  </div>;
}
export function AtlasArticleHero({ entry }: { entry: FoodEntry }) {
  return <section className="atlas-article-hero">
    <div className="atlas-article-hero-copy"><span className="atlas-kicker">{entry.eyebrow}</span>
      <h1>{entry.title}</h1><p>{entry.description}</p>
      <div className="atlas-hero-tags">{entry.facts.slice(0, 3).map((item) => <span key={item.label}>{item.label}: {item.value}</span>)}</div>
    </div>
    <AtlasArt entry={entry} featured />
  </section>;
}
export function AtlasSectionHeading({ kicker, title, description, action }: {
  kicker: string; title: string; description?: string; action?: { label: string; href: string };
}) {
  return <div className="atlas-section-heading"><div><span className="atlas-kicker">{kicker}</span><h2>{title}</h2>
    {description && <p>{description}</p>}</div>
    {action && <Link href={action.href} className="atlas-more-link">{action.label}<ArrowRight size={18} aria-hidden="true" /></Link>}
  </div>;
}
export function AtlasEmptyState({ title, description }: { title: string; description: string }) {
  return <div className="atlas-empty-state"><Sparkles size={31} aria-hidden="true" /><h2>{title}</h2><p>{description}</p>
    <Link href="/explore/browse" className="atlas-button">Browse all topics<ArrowRight size={17} aria-hidden="true" /></Link></div>;
}
