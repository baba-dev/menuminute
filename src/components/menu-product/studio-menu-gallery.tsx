"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveRestore,
  BookOpen,
  ChefHat,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { dishVisual, startingPriceMinor } from "@/modules/menu-product/public-presentation";
import { formatPrice } from "@/lib/utils";
import { DiningImage } from "./dining-image";

export type MenuLibraryEntry = {
  id: string;
  document: unknown;
  archived: boolean;
  revision?: number;
  publishedRevision?: number | null;
};

export type MenuLibraryAction = "archive" | "unpublish" | "restore";

type LibraryMenu = MenuLibraryEntry & { parsed: MenuDocument | null; title: string };
type DishWithCategory = {
  categoryId: string;
  category: string;
  dish: MenuDocument["categories"][number]["items"][number];
};

export function libraryMenus(entries: MenuLibraryEntry[]): LibraryMenu[] {
  return entries.map((entry) => {
    const parsed = menuDocumentSchema.safeParse(entry.document);
    return {
      ...entry,
      parsed: parsed.success ? parsed.data : null,
      title: parsed.success ? parsed.data.name : "Menu unavailable",
    };
  });
}

export function menuLibraryStatus(menu: MenuLibraryEntry): string {
  if (menu.archived) return "Recently deleted";
  if (!menu.publishedRevision) return "Private draft";
  if (menu.revision && menu.revision > menu.publishedRevision) return "Live + draft";
  return "Live";
}

export function StudioMenuGallery({
  open,
  menus,
  currentMenuId,
  currency,
  busy,
  error,
  onClose,
  onCreate,
  onOpenMenu,
  onPreviewMenu,
  onManage,
}: {
  open: boolean;
  menus: MenuLibraryEntry[];
  currentMenuId: string;
  currency: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onCreate: () => Promise<boolean>;
  onOpenMenu: (id: string) => Promise<boolean>;
  onPreviewMenu: (id: string) => Promise<boolean>;
  onManage: (id: string, action: MenuLibraryAction) => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [visibleCount, setVisibleCount] = useState(48);
  const [pending, setPending] = useState(false);
  const library = useMemo(() => libraryMenus(menus), [menus]);
  const selected = library.find((menu) => menu.id === (activeId ?? currentMenuId)) ?? library[0];
  const displayed = library.filter((menu) =>
    menu.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );
  const sections = selected?.parsed?.categories.filter((section) => !section.archived) ?? [];
  const dishes = sections.flatMap((section): DishWithCategory[] =>
    section.items
      .filter((dish) => !dish.archived)
      .map((dish) => ({ categoryId: section.id, category: section.name, dish }))
  );
  const filteredDishes =
    category === "all" ? dishes : dishes.filter((item) => item.categoryId === category);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      returnFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      node.showModal();
    } else if (!open && node.open) {
      node.close();
    }
  }, [open]);

  function closeLibrary() {
    setActiveId(null);
    setCategory("all");
    setVisibleCount(48);
    setSearch("");
    onClose();
  }

  async function perform(task: () => Promise<boolean>) {
    if (busy || pending) return;
    setPending(true);
    try {
      if (await task()) closeLibrary();
    } finally {
      setPending(false);
    }
  }

  function choose(id: string) {
    setActiveId(id);
    setCategory("all");
    setVisibleCount(48);
  }

  const inactive = busy || pending;
  return (
    <dialog
      ref={dialog}
      className="atelier-gallery-dialog"
      aria-labelledby="atelier-gallery-title"
      onCancel={(event) => {
        if (inactive) event.preventDefault();
      }}
      onClose={() => {
        closeLibrary();
        returnFocus.current?.focus();
      }}
    >
      <header className="atelier-gallery-header">
        <div>
          <span className="atelier-eyebrow">YOUR MENU LIBRARY</span>
          <h2 id="atelier-gallery-title">Your menus</h2>
          <p className="atelier-supporting-text">
            Browse your menus and their saved dishes. Guests see only explicitly published releases.
          </p>
        </div>
        <div className="atelier-gallery-heading-actions">
          <button
            type="button"
            className="ember"
            disabled={inactive}
            onClick={() => void perform(onCreate)}
          >
            <Plus size={17} aria-hidden="true" /> Create menu
          </button>
          <button
            type="button"
            className="atelier-gallery-close"
            aria-label="Close your menus"
            disabled={inactive}
            onClick={closeLibrary}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
      </header>

      {error && (
        <p className="atelier-gallery-error" role="alert">
          {error}
        </p>
      )}
      <div className="atelier-gallery-layout">
        <nav className="atelier-gallery-rail" aria-label="Menus in this outlet">
          <label className="atelier-gallery-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search menu names</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find a menu…"
              disabled={inactive}
            />
          </label>
          <div className="atelier-gallery-rail-items">
            {displayed.map((menu) => (
              <button
                key={menu.id}
                type="button"
                aria-current={menu.id === activeId ? "true" : undefined}
                className={menu.id === activeId ? "is-selected" : ""}
                onClick={() => choose(menu.id)}
                disabled={inactive}
              >
                <span className="atelier-gallery-menu-name">{menu.title}</span>
                <span className="atelier-gallery-menu-meta">
                  <span className={menu.publishedRevision && !menu.archived ? "is-live" : ""} />
                  {menuLibraryStatus(menu)}
                </span>
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            ))}
            {!displayed.length && (
              <p className="atelier-supporting-text">No menus match your search.</p>
            )}
          </div>
        </nav>

        <section className="atelier-gallery-content" aria-label="Selected menu details">
          {selected ? (
            <>
              <div className="atelier-gallery-menu-heading">
                <div className="atelier-gallery-heading-copy">
                  <span className="atelier-eyebrow">SELECTED MENU</span>
                  <h3>{selected.title}</h3>
                  <p className="atelier-supporting-text">
                    {menuLibraryStatus(selected)} · {sections.length} sections · {dishes.length}{" "}
                    dishes
                    {selected.id === currentMenuId ? " · Open in Studio" : ""}
                  </p>
                </div>
                <details className="atelier-gallery-actions">
                  <summary>Menu actions</summary>
                  <div className="atelier-gallery-actions-list">
                    <button
                      type="button"
                      disabled={inactive || selected.archived}
                      onClick={() => void perform(() => onOpenMenu(selected.id))}
                    >
                      <BookOpen size={16} aria-hidden="true" /> Open in Studio
                    </button>
                    <button
                      type="button"
                      disabled={inactive || selected.archived}
                      onClick={() => void perform(() => onPreviewMenu(selected.id))}
                    >
                      <Eye size={16} aria-hidden="true" /> Preview draft
                    </button>
                    {selected.archived ? (
                      <button
                        type="button"
                        disabled={inactive}
                        onClick={() => void perform(() => onManage(selected.id, "restore"))}
                      >
                        <ArchiveRestore size={16} aria-hidden="true" /> Restore menu
                      </button>
                    ) : (
                      <>
                        {Boolean(selected.publishedRevision) && (
                          <button
                            type="button"
                            disabled={inactive}
                            onClick={() => void perform(() => onManage(selected.id, "unpublish"))}
                          >
                            <EyeOff size={16} aria-hidden="true" /> Unpublish menu
                          </button>
                        )}
                        <button
                          type="button"
                          className="atelier-gallery-danger"
                          disabled={inactive}
                          onClick={() => void perform(() => onManage(selected.id, "archive"))}
                        >
                          <Trash2 size={16} aria-hidden="true" /> Delete menu
                        </button>
                      </>
                    )}
                  </div>
                </details>
              </div>
              {selected.parsed ? (
                <>
                  <div className="atelier-gallery-categories" aria-label="Dish categories">
                    <button
                      type="button"
                      aria-pressed={category === "all"}
                      onClick={() => {
                        setCategory("all");
                        setVisibleCount(48);
                      }}
                    >
                      All dishes
                    </button>
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        aria-pressed={category === section.id}
                        onClick={() => {
                          setCategory(section.id);
                          setVisibleCount(48);
                        }}
                      >
                        {section.name}
                      </button>
                    ))}
                  </div>
                  {filteredDishes.length ? (
                    <>
                      <div className="atelier-gallery-dish-grid">
                        {filteredDishes
                          .slice(0, visibleCount)
                          .map(({ category: categoryName, dish }) => (
                            <article key={dish.id} className="atelier-gallery-dish">
                              <DiningImage
                                visual={dishVisual(dish, categoryName, true)}
                                className="atelier-gallery-dish-image"
                              />
                              <div className="atelier-gallery-dish-body">
                                <span className="atelier-gallery-dish-section">{categoryName}</span>
                                <h4>{dish.name}</h4>
                                {dish.description && (
                                  <p className="atelier-supporting-text">{dish.description}</p>
                                )}
                                <div className="atelier-gallery-dish-bottom">
                                  <strong>
                                    {dish.variants.length ? "From " : ""}
                                    {formatPrice(startingPriceMinor(dish), currency)}
                                  </strong>
                                  {dish.soldOut && (
                                    <span className="atelier-gallery-sold-out">Sold out</span>
                                  )}
                                </div>
                              </div>
                            </article>
                          ))}
                      </div>
                      {visibleCount < filteredDishes.length && (
                        <button
                          type="button"
                          className="atelier-gallery-more"
                          onClick={() => setVisibleCount((count) => count + 48)}
                        >
                          Show more dishes ({filteredDishes.length - visibleCount} remaining)
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="atelier-gallery-empty">
                      <ChefHat size={32} aria-hidden="true" />
                      <strong>No dishes yet</strong>
                      <p className="atelier-supporting-text">
                        Open this menu in Studio to add your first dish.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="atelier-gallery-error" role="alert">
                  This menu&apos;s saved document could not be read. Reopen it in Studio to
                  investigate.
                </p>
              )}
            </>
          ) : (
            <div className="atelier-gallery-empty">
              <BookOpen size={34} aria-hidden="true" />
              <strong>Your menu library is empty.</strong>
              <p className="atelier-supporting-text">
                Create a menu to start building your restaurant&apos;s catalogue.
              </p>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}
