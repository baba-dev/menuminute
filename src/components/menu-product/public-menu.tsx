"use client";
import { useEffect, useState } from "react";
import { UtensilsCrossed, Search, Leaf, Clock } from "lucide-react";
import { projectMenu } from "@/modules/menu-product/projector";
import type { PublicProduct } from "@/modules/menu-product/service";
import { formatPrice } from "@/lib/utils";
import { DishDetail } from "./dish-detail";
// Keep the schedule projector in a client-safe module; the server data module is imported as types only.
export function PublicMenu({
  initial,
  token,
  preview = false,
}: {
  initial: PublicProduct;
  token?: string;
  preview?: boolean;
}) {
  const [data, setData] = useState(initial),
    [search, setSearch] = useState(""),
    [diet, setDiet] = useState("all"),
    [status, setStatus] = useState("");
  const [detail, setDetail] = useState<{
    dish: Parameters<typeof DishDetail>[0]["dish"];
    currency: string;
  } | null>(null);
  useEffect(() => {
    if (!token || preview) return;
    let stopped = false;
    const refresh = async () => {
      try {
        const r = await fetch(`/api/public-menu/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!r.ok) {
          if (!stopped) {
            if (r.status === 404 || r.status === 410) {
              // Revoked/deleted QR must not leave stale published dishes on screen.
              setData((previous) => ({ ...previous, menus: [] }));
              setDetail(null);
              setStatus("This menu is no longer available. Please ask the staff.");
            } else {
              setStatus("Menu updates could not be checked. This view may be outdated.");
            }
          }
          return;
        }
        const next = await r.json();
        if (!stopped) {
          setData(next);
          setStatus("");
        }
      } catch {
        if (!stopped)
          setStatus(
            "You are offline. This menu was last loaded earlier; availability may have changed."
          );
      }
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("online", refresh);
    const offline = () => setStatus("You are offline. Availability may have changed.");
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
    };
  }, [token, preview]);
  const docs = data.menus.map((m) => ({
    ...m,
    view: projectMenu(m.document, data.outlet.timezone, new Date(data.now), m.overrides),
  }));
  const normalizedSearch = search.trim().toLowerCase();
  const matches = (
    item: { name: string; description: string; dietary: readonly string[] },
    categoryName: string
  ) =>
    (!normalizedSearch ||
      `${item.name} ${item.description} ${categoryName}`
        .toLowerCase()
        .includes(normalizedSearch)) &&
    (diet === "all" || item.dietary.includes(diet));
  const shown = docs.reduce(
    (count, menu) =>
      count +
      menu.view.categories.reduce(
        (total, category) =>
          total + category.items.filter((item) => matches(item, category.name)).length,
        0
      ),
    0
  );
  return (
    <div className="product">
      <a className="skip-link" href="#dishes">
        Skip to dishes
      </a>
      <div className="public-shell stack editorial-menu">
        <header className="hero">
          <div className="stack">
            <span className="eyebrow">Made to be savoured · Digital menu</span>
            <h1>{data.outlet.name}</h1>
            <div className="row">
              <span className="badge">{data.outlet.outletType.replaceAll("_", " ")}</span>
              {data.point && <span className="badge">{data.point}</span>}
              <span className="badge">{data.outlet.currency}</span>
              {data.outlet.isDemoData && <span className="badge">Sample Menu</span>}
              {preview && <span className="badge">Draft preview — not public</span>}
            </div>
            <p>Explore our dishes. Please order and pay with the restaurant team.</p>
          </div>
          <UtensilsCrossed className="hero-mark" aria-hidden="true" />
        </header>
        <div className="public-toolbar stack no-print">
          <div className="row">
            <label className="field" style={{ flex: 2 }}>
              <span className="row">
                <Search size={16} />
                Search the menu
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="A dish, ingredient or category"
              />
            </label>
            <label className="field">
              Dietary filter
              <select
                aria-label="Dietary filter"
                value={diet}
                onChange={(e) => setDiet(e.target.value)}
              >
                <option value="all">All dishes</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="gluten_free">Gluten free</option>
              </select>
            </label>
          </div>
          <nav aria-label="Menu categories" className="scroll-links">
            {docs.flatMap((m) =>
              m.view.categories
                .filter((c) => c.items.some((i) => matches(i, c.name)))
                .map((c) => (
                  <a className="action" key={m.id + c.id} href={`#c-${m.id}-${c.id}`}>
                    {c.name}
                  </a>
                ))
            )}
          </nav>
          <p className="quiet" role="status">
            {shown} {shown === 1 ? "dish" : "dishes"} shown
          </p>
        </div>
        {status && (
          <p role="status" className="error">
            {status}
          </p>
        )}
        <main tabIndex={-1} id="dishes" className="stack">
          {docs.map((m) => (
            <div key={m.id} className="stack">
              <div className="row between">
                <div>
                  <span className="eyebrow">{m.brand ?? "From our kitchen"}</span>
                  <h2>{m.view.name}</h2>
                </div>
                <span className="badge">
                  <Clock size={13} style={{ display: "inline" }} />{" "}
                  {m.view.open ? "Current service" : "Outside scheduled service"}
                </span>
              </div>
              {m.view.categories.map((c) => {
                const items = c.items.filter((i) => matches(i, c.name));
                if (!items.length) return null;
                return (
                  <section key={c.id} id={`c-${m.id}-${c.id}`} className="stack">
                    <div>
                      <h2>{c.name}</h2>
                      {c.description && <p>{c.description}</p>}
                    </div>
                    <div className="dish-grid">
                      {items.map((i) => (
                        <article key={i.id} className={`dish-card ${i.soldOut ? "sold-out" : ""}`}>
                          <div className="dish-image">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                i.mediaId
                                  ? `/api/public-media/${i.mediaId}?size=thumb`
                                  : "/icons/category-default.svg"
                              }
                              alt={i.mediaId ? i.name : "Dish illustration"}
                              width={160}
                              height={160}
                              loading="lazy"
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "/icons/category-default.svg";
                              }}
                            />
                            {i.soldOut && <span className="sold-label">Sold Out</span>}
                          </div>
                          <div className="stack" style={{ gap: ".4rem" }}>
                            <div className="row between">
                              <h3>{i.name}</h3>
                              <span className="money">
                                {i.variants.length ? "From " : ""}
                                {formatPrice(
                                  i.variants.length
                                    ? Math.min(
                                        ...(i.variants.some((v) => v.isAvailable)
                                          ? i.variants.filter((v) => v.isAvailable)
                                          : i.variants
                                        ).map((v) => v.priceMinor)
                                      )
                                    : i.priceMinor,
                                  m.view.currency
                                )}
                              </span>
                            </div>
                            {i.description && <p>{i.description}</p>}
                            {!i.open && <span className="badge">Outside service time</span>}
                            <div className="row">
                              {i.dietary.map((d) => (
                                <span key={d} className="badge">
                                  <Leaf size={12} style={{ display: "inline" }} />{" "}
                                  {d.replaceAll("_", " ")}
                                </span>
                              ))}
                            </div>
                            <button
                              className="dish-explore"
                              type="button"
                              onClick={() => setDetail({ dish: i, currency: m.view.currency })}
                              aria-label={`View ${i.name} details`}
                            >
                              View dish <span aria-hidden="true">↗</span>
                            </button>
                            {(i.variants.length > 0 || i.addOnGroups.length > 0) && (
                              <details>
                                <summary>Variants & add-ons</summary>
                                <div className="stack">
                                  {i.variants.map((v) => (
                                    <p key={v.id}>
                                      {v.name} · {formatPrice(v.priceMinor, m.view.currency)}
                                      {!v.isAvailable ? " · Sold Out" : ""}
                                    </p>
                                  ))}
                                  {i.addOnGroups.map((g) => (
                                    <div key={g.id}>
                                      <strong>{g.name}</strong>
                                      <p>
                                        {g.min ? "Required" : "Optional"} · choose {g.min}–{g.max}
                                      </p>
                                      {g.options.map((o) => (
                                        <p key={o.id}>
                                          {o.name} +{formatPrice(o.priceMinor, m.view.currency)}
                                          {!o.isAvailable ? " · Sold Out" : ""}
                                        </p>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
          {shown === 0 && (
            <div className="panel quiet">
              <h2>
                {search || diet !== "all" ? "No matching dishes" : "No dishes in this service"}
              </h2>
              <p>
                {search || diet !== "all"
                  ? "Try another search or clear your filters."
                  : "Please ask the team about today’s menu."}
              </p>
              {(search || diet !== "all") && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDiet("all");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </main>
        {detail && (
          <DishDetail
            dish={detail.dish}
            currency={detail.currency}
            onClose={() => setDetail(null)}
          />
        )}
        <footer className="row between">
          <small>
            Dietary information is supplied by the restaurant. Ask staff about allergens.
          </small>
          <small>Powered by MenuMinute · Free QR menus</small>
        </footer>
      </div>
    </div>
  );
}
