"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Search, Leaf, Clock, Plus } from "lucide-react";
import { projectMenu } from "@/modules/menu-product/projector";
import type { PublicProduct } from "@/modules/menu-product/service";
import { formatPrice } from "@/lib/utils";
import { ItemCustomizer, type CustomizerDish, type CartItem } from "./item-customizer";
import { CartDrawer } from "./cart-drawer";

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
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [search, setSearch] = useState("");
  const [diet, setDiet] = useState("all");
  const [status, setStatus] = useState("");

  // Online Ordering Cart & Customization State
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      try {
        const stored = sessionStorage.getItem(`cart_${token}`);
        const parsed = stored ? JSON.parse(stored) : [];
        setCartItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCartItems([]);
      } finally {
        setCartHydrated(true);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token]);

  const [customizingDish, setCustomizingDish] = useState<CustomizerDish | null>(null);

  // Sync cart to sessionStorage
  useEffect(() => {
    if (typeof window === "undefined" || !token || !cartHydrated) return;
    try {
      sessionStorage.setItem(`cart_${token}`, JSON.stringify(cartItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartItems, token, cartHydrated]);

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

  const handleAddToCart = (item: CartItem) => {
    setCartItems((prev) => [...prev, item]);
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }
    setCartItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index] = { ...copy[index], quantity: newQty };
      }
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCartItems([]);
    if (typeof window !== "undefined" && token) {
      sessionStorage.removeItem(`cart_${token}`);
    }
  };

  const handleOrderSubmitted = (result: { orderId: string; trackingToken: string }) => {
    if (token) {
      try {
        sessionStorage.setItem(`order_${token}_${result.orderId}`, result.trackingToken);
      } catch {
        /* Storage unavailable */
      }
      router.push(`/m/${token}/orders/${result.orderId}`);
    }
  };

  return (
    <div className="product" style={{ paddingBottom: cartItems.length > 0 ? "5rem" : "2rem" }}>
      <a className="skip-link" href="#dishes">
        Skip to dishes
      </a>
      <div className="public-shell stack">
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
            <p>
              {data.outlet.orderingEnabled
                ? "Explore our dishes. Add to your order and pay with the restaurant team."
                : "Explore our digital menu. Online ordering is not enabled for this outlet."}
            </p>
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
                          <div className="stack" style={{ gap: ".4rem", flex: 1 }}>
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
                            {!data.outlet.orderingEnabled &&
                              (i.variants.length > 0 || i.addOnGroups.length > 0) && (
                                <div className="stack" aria-label={`Options for ${i.name}`}>
                                  <small className="quiet">Variants & add-ons</small>
                                  {i.variants.map((variant) => (
                                    <small key={variant.id}>
                                      {variant.name} · {formatPrice(variant.priceMinor, m.view.currency)}
                                    </small>
                                  ))}
                                  {i.addOnGroups.map((group) => (
                                    <div key={group.id} className="stack">
                                      <small className="quiet">{group.name}</small>
                                      {group.options.map((option) => (
                                        <small key={option.id}>
                                          {option.name} · {formatPrice(option.priceMinor, m.view.currency)}
                                        </small>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              )}
                            {!i.open && <span className="badge">Outside service time</span>}
                            <div className="row">
                              {i.dietary.map((d) => (
                                <span key={d} className="badge">
                                  <Leaf size={12} style={{ display: "inline" }} />{" "}
                                  {d.replaceAll("_", " ")}
                                </span>
                              ))}
                            </div>

                            {/* Add to Cart CTA Button */}
                            <div
                              className="row between"
                              style={{ marginTop: "auto", paddingTop: "0.5rem" }}
                            >
                              <button
                                type="button"
                                className="action"
                                style={{
                                  borderRadius: "10px",
                                  padding: "0.45rem 0.9rem",
                                  fontSize: "0.85rem",
                                  gap: "0.3rem",
                                }}
                                disabled={
                                  i.soldOut || !i.open || preview || !data.outlet.orderingEnabled
                                }
                                onClick={() => setCustomizingDish(i)}
                              >
                                <Plus size={14} /> Add
                              </button>

                              {(i.variants.length > 0 || i.addOnGroups.length > 0) && (
                                <small className="quiet" style={{ fontSize: "0.75rem" }}>
                                  Customizable
                                </small>
                              )}
                            </div>
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

        <footer className="row between">
          <small>
            Dietary information is supplied by the restaurant. Ask staff about allergens.
          </small>
          <small>Powered by MenuMinute · Free QR menus & Online Ordering</small>
        </footer>
      </div>

      {/* Item Customizer Modal */}
      <ItemCustomizer
        key={customizingDish?.id ?? "empty"}
        dish={customizingDish}
        currency={data.outlet.currency}
        isOpen={!!customizingDish}
        onClose={() => setCustomizingDish(null)}
        onAddToCart={handleAddToCart}
      />

      {/* Sticky Cart Drawer */}
      {token && data.outlet.orderingEnabled && (
        <CartDrawer
          items={cartItems}
          currency={data.outlet.currency}
          token={token}
          outletName={data.outlet.name}
          point={data.point}
          fulfillmentModes={data.outlet.fulfillmentModes}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOrderSubmitted={handleOrderSubmitted}
        />
      )}
    </div>
  );
}
