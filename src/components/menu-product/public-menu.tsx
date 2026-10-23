"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Leaf,
  Clock,
  Plus,
  ArrowUpRight,
  ChefHat,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { projectMenu } from "@/modules/menu-product/projector";
import {
  coverFor,
  categoryImage,
  dishVisual,
  featuredForMenu,
  startingPriceMinor,
} from "@/modules/menu-product/public-presentation";
import { DiningImage } from "./dining-image";
import { restoreGuestCart } from "@/modules/menu-product/cart-storage";
import type { PublicProduct } from "@/modules/menu-product/service";
import { formatPrice } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { CustomizerDish, CartItem } from "./item-customizer";
const ItemCustomizer = dynamic(
  () => import("./item-customizer").then((mod) => mod.ItemCustomizer),
  { ssr: false }
);
const CartDrawer = dynamic(() => import("./cart-drawer").then((mod) => mod.CartDrawer), {
  ssr: false,
});

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
        const available = new Set(
          initial.menus.flatMap((menu) =>
            menu.document.categories.flatMap((category) =>
              category.items.filter((item) => !item.archived).map((item) => item.id)
            )
          )
        );
        setCartItems(restoreGuestCart(parsed, available));
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
  }, [token, initial]);

  const [customizingDish, setCustomizingDish] = useState<CustomizerDish | null>(null);
  const [customizingCategory, setCustomizingCategory] = useState("");

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
              setCartItems([]);
              try {
                sessionStorage.removeItem("cart_" + token);
              } catch {
                /* storage unavailable */
              }
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

  const featured = docs.flatMap((menu) => featuredForMenu(menu.id, menu.view));
  const ordering = Boolean(
    data.outlet.orderingEnabled && !preview && token && !status.includes("no longer")
  );
  const browseOnly = !ordering;
  const openDish = (dish: CustomizerDish, category: string) => {
    setCustomizingCategory(category);
    setCustomizingDish(dish);
  };
  const suggestions = docs
    .flatMap((menu) =>
      menu.view.categories.flatMap((category) =>
        category.items
          .filter(
            (dish) =>
              !dish.soldOut && dish.open && !cartItems.some((item) => item.dishId === dish.id)
          )
          .filter((dish) => (menu.view.presentation?.featuredDishIds ?? []).includes(dish.id))
          .map((dish) => ({
            dish,
            category: category.name,
            currency: menu.view.currency,
            visual: dishVisual(dish, category.name, preview),
          }))
      )
    )
    .slice(0, 3);

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
    <div
      className="product dining-canvas"
      style={{ paddingBottom: cartItems.length > 0 ? "6rem" : "2rem" }}
    >
      <a className="skip-link" href="#dishes">
        Skip to dishes
      </a>
      <header className="dining-cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="dining-cover-image"
          src={coverFor(docs[0]?.view)}
          alt=""
          width={2172}
          height={724}
          fetchPriority="high"
        />
        <div className="dining-cover-content">
          <span className="dining-kicker">
            THE DINING CANVAS <span aria-hidden="true">✳</span> YOUR DIGITAL MENU
          </span>
          <h1>{data.outlet.name}</h1>
          <p>
            {docs[0]?.view.presentation?.headline ||
              "Made with care. Served with joy. Find something delicious."}
          </p>
          <div className="dining-cover-details">
            <span>{data.outlet.outletType.replaceAll("_", " ")}</span>
            {data.point && <span>{data.point}</span>}
            {data.outlet.isDemoData && <span>Sample menu</span>}
            {preview && <strong>Draft preview — not public</strong>}
            {ordering && <span>Order with the restaurant</span>}
          </div>
          <a href="#dishes" className="dining-explore">
            Explore our food <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>
      <div className="dining-shell">
        {status && (
          <p role="status" className="dining-notice">
            {status}
          </p>
        )}
        <div className="dining-find no-print" aria-label="Find dishes">
          <div className="dining-heading-row">
            <div>
              <span className="dining-kicker">A LITTLE SOMETHING FOR EVERYONE</span>
              <h2>What sounds good?</h2>
            </div>
            <span className="dining-count" role="status">
              {shown} {shown === 1 ? "dish" : "dishes"} shown
            </span>
          </div>
          <label className="dining-search">
            <Search size={21} aria-hidden="true" />
            <span className="sr-only">Search the menu</span>
            <input
              aria-label="Search the menu"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes, descriptions or categories…"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                Clear
              </button>
            )}
          </label>
          <div className="dining-diets" role="group" aria-label="Dietary filter">
            {(
              [
                ["all", "All dishes"],
                ["vegetarian", "Vegetarian"],
                ["vegan", "Vegan"],
                ["gluten_free", "Gluten free"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={diet === value}
                className={diet === value ? "is-active" : ""}
                onClick={() => setDiet(value)}
              >
                {value === "vegetarian" && <Leaf size={15} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
        </div>
        <nav className="dining-categories no-print" aria-label="Menu categories">
          {docs.flatMap((menu) =>
            menu.view.categories
              .filter((category) => category.items.some((item) => matches(item, category.name)))
              .map((category) => (
                <a
                  key={menu.id + category.id}
                  href={"#c-" + menu.id + "-" + category.id}
                  className="dining-category-tile"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={categoryImage(category.name)}
                    alt=""
                    width={96}
                    height={96}
                    loading="lazy"
                  />
                  <span>{category.name}</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </a>
              ))
          )}
        </nav>
        {featured.length > 0 && !search && diet === "all" && (
          <section className="dining-featured no-print" aria-labelledby="dining-featured-title">
            <div className="dining-heading-row">
              <div>
                <span className="dining-kicker">
                  <Sparkles size={14} aria-hidden="true" /> HANDPICKED BY THE RESTAURANT
                </span>
                <h2 id="dining-featured-title">From our favourites</h2>
              </div>
              <span className="dining-caption">A little inspiration for your order.</span>
            </div>
            <div className="dining-featured-grid">
              {featured.map(({ menuId, categoryName, dish, currency }) => (
                <article key={menuId + ":" + dish.id} className="dining-feature-card">
                  <DiningImage visual={dishVisual(dish, categoryName, preview)} />
                  <div>
                    <span className="dining-kicker">{categoryName}</span>
                    <h3>{dish.name}</h3>
                    <span className="dining-price">
                      {dish.variants.length ? "From " : ""}
                      {formatPrice(startingPriceMinor(dish), currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDish(dish, categoryName)}
                      aria-label={"View " + dish.name + " details"}
                    >
                      Discover dish <ArrowUpRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <main id="dishes" tabIndex={-1} className="dining-menu">
          {docs.map((menu) => (
            <div key={menu.id} className="dining-menu-release">
              <div className="dining-release-header">
                <div>
                  <span className="dining-kicker">{menu.brand ?? "FRESH FROM OUR KITCHEN"}</span>
                  <h2>{menu.view.name}</h2>
                </div>
                <span className="dining-service">
                  <Clock size={14} aria-hidden="true" />{" "}
                  {menu.view.open ? "Current service" : "Outside scheduled service"}
                </span>
              </div>
              {menu.view.categories.map((category) => {
                const items = category.items.filter((item) => matches(item, category.name));
                if (!items.length) return null;
                return (
                  <section
                    key={category.id}
                    id={"c-" + menu.id + "-" + category.id}
                    className="dining-section"
                    aria-labelledby={"title-" + menu.id + "-" + category.id}
                  >
                    <div className="dining-section-head">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={categoryImage(category.name)}
                        alt=""
                        width={84}
                        height={84}
                        loading="lazy"
                      />
                      <div>
                        <span className="dining-kicker">EXPLORE THE MENU</span>
                        <h2 id={"title-" + menu.id + "-" + category.id}>{category.name}</h2>
                        {category.description && <p>{category.description}</p>}
                      </div>
                      <span className="dining-section-count">
                        {items.length} {items.length === 1 ? "dish" : "dishes"}
                      </span>
                    </div>
                    <div className="dining-grid">
                      {items.map((dish) => {
                        const unavailable = dish.soldOut || !dish.open;
                        const image = dishVisual(dish, category.name, preview);
                        const price = startingPriceMinor(dish);
                        return (
                          <article
                            key={dish.id}
                            className={"dining-dish " + (unavailable ? "is-unavailable" : "")}
                          >
                            <button
                              type="button"
                              className="dining-photo-button"
                              onClick={() => openDish(dish, category.name)}
                              aria-label={"View " + dish.name + " details"}
                            >
                              <DiningImage visual={image} />
                              {dish.soldOut && <span className="dining-sold">Sold Out</span>}
                            </button>
                            <div className="dining-dish-content">
                              <div className="dining-dish-title">
                                <h3>{dish.name}</h3>
                                <strong>
                                  {dish.variants.length ? "From " : ""}
                                  {formatPrice(price, menu.view.currency)}
                                </strong>
                              </div>
                              {dish.description && <p>{dish.description}</p>}
                              <div className="dining-tags">
                                {dish.dietary.map((value) => (
                                  <span key={value}>
                                    <Leaf size={12} aria-hidden="true" />
                                    {value.replaceAll("_", " ")}
                                  </span>
                                ))}
                                {dish.variants.length + dish.addOnGroups.length > 0 && (
                                  <span>Customizable</span>
                                )}
                                {!dish.open && <span>Outside service time</span>}
                              </div>
                              <button
                                type="button"
                                className={
                                  "dining-dish-cta " + (unavailable || browseOnly ? "is-quiet" : "")
                                }
                                disabled={unavailable && !browseOnly}
                                onClick={() => openDish(dish, category.name)}
                              >
                                {browseOnly
                                  ? "View dish"
                                  : unavailable
                                    ? "Unavailable"
                                    : "Add to order"}
                                {browseOnly ? (
                                  <ArrowUpRight size={17} aria-hidden="true" />
                                ) : (
                                  <Plus size={17} aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
          {shown === 0 && (
            <div className="dining-empty">
              <ChefHat size={34} aria-hidden="true" />
              <h2>
                {search || diet !== "all" ? "No matching dishes" : "No dishes in this service"}
              </h2>
              <p>
                {search || diet !== "all"
                  ? "Try another search or clear your filters."
                  : "Please ask the restaurant team about today’s menu."}
              </p>
              {(search || diet !== "all") && (
                <button
                  type="button"
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
        <footer className="dining-footer">
          <small>
            Dietary information is supplied by the restaurant. Ask staff about allergens.
          </small>
          <small>Made to be savoured · Powered by MenuMinute</small>
        </footer>
      </div>
      {customizingDish && (
        <ItemCustomizer
          key={customizingDish?.id ?? "empty"}
          dish={customizingDish}
          visual={
            customizingDish ? dishVisual(customizingDish, customizingCategory, preview) : null
          }
          currency={data.outlet.currency}
          readOnly={
            browseOnly || Boolean(customizingDish?.soldOut || customizingDish?.open === false)
          }
          isOpen={Boolean(customizingDish)}
          onClose={() => setCustomizingDish(null)}
          onAddToCart={handleAddToCart}
        />
      )}
      {ordering && token && (
        <CartDrawer
          items={cartItems}
          currency={data.outlet.currency}
          token={token}
          outletName={data.outlet.name}
          point={data.point}
          fulfillmentModes={data.outlet.fulfillmentModes}
          images={Object.fromEntries(
            docs.flatMap((menu) =>
              menu.view.categories.flatMap((category) =>
                category.items.map(
                  (dish) => [dish.id, dishVisual(dish, category.name, preview)] as const
                )
              )
            )
          )}
          suggestions={suggestions}
          onChooseSuggestion={(dish, category) => openDish(dish, category)}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOrderSubmitted={handleOrderSubmitted}
        />
      )}
    </div>
  );
}
