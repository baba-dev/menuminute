"use client";
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ImagePlus, Plus, Search, ShoppingBasket, X } from "lucide-react";
import { displayToMinor } from "@/lib/money";
import { artworkForDish, artworkById, dishImageSrc } from "@/modules/menu-product/dish-artwork";
/* eslint-disable @next/next/no-img-element -- Authenticated private media must use its existing scoped route. */
import type { MenuDocument } from "@/modules/menu-product/contracts";
import {
  existingFromDocument,
  normalizeDishText,
  rankDishSuggestions,
  recentFromDocument,
  batchCandidates,
  type OrganizationDish,
  type Suggestion,
} from "@/modules/menu-product/dish-intelligence";

type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
export type QuickDish = {
  key: string;
  name: string;
  categoryId: string;
  priceText: string;
  free: boolean;
  mediaId: string | null;
  artworkId: string | null;
  imageMode: "artwork" | "photo" | "none";
};
export function SmartDishComposer({
  doc,
  outletId,
  menuId,
  media,
  organization,
  defaultCategoryId,
  focusRequest,
  selection,
  setSelection,
  onAdd,
  onPendingChange,
}: {
  doc: MenuDocument;
  outletId: string;
  menuId: string;
  media: Media[];
  organization: OrganizationDish[];
  defaultCategoryId: string;
  focusRequest: number;
  selection: QuickDish[];
  setSelection: Dispatch<SetStateAction<QuickDish[]>>;
  onAdd: (dishes: QuickDish[], newSectionName: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [review, setReview] = useState(false);
  const reviewRef = useRef<HTMLDivElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const [reviewPulse, setReviewPulse] = useState(0);
  useEffect(() => {
    if (!review) return;
    const frame = requestAnimationFrame(() => {
      reviewRef.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      reviewHeading.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [review, reviewPulse]);
  const enterReview = () => { setReview(true); setReviewPulse((n) => n + 1); };
  const [expanded, setExpanded] = useState(true);
  const [active, setActive] = useState(0);
  const [newSection, setNewSection] = useState("");
  const [error, setError] = useState("");
  const [photoPickerKey, setPhotoPickerKey] = useState<string | null>(null);
  const [photoLimit, setPhotoLimit] = useState(24);
  const approved = media.filter((m) => m.status === "ready" && !!m.approvedAt);
  useEffect(() => {
    if (focusRequest) input.current?.focus();
  }, [focusRequest]);
  const existing = useMemo(
    () => existingFromDocument(doc, outletId, menuId),
    [doc, outletId, menuId]
  );
  const matches = useMemo(
    () => rankDishSuggestions({ query, outletId, menuId, existing, organization, limit: 7 }),
    [query, outletId, menuId, existing, organization]
  );
  const recent = useMemo(() => recentFromDocument(doc), [doc]);
  const clean = normalizeDishText(query);
  const custom = query.trim().slice(0, 100);
  const alreadySelected = (name: string) =>
    selection.some((s) => normalizeDishText(s.name) === normalizeDishText(name));
  const makeQuickDish = (
    s: Pick<Suggestion, "key" | "name" | "categoryHint" | "categoryId" | "mediaId">
  ): QuickDish => {
    const hint = doc.categories.find(
      (c) => !c.archived && normalizeDishText(c.name) === normalizeDishText(s.categoryHint)
    );
    const target =
      (defaultCategoryId && doc.categories.some((c) => c.id === defaultCategoryId && !c.archived)
        ? defaultCategoryId
        : null) ??
      (s.categoryId && doc.categories.some((c) => c.id === s.categoryId && !c.archived)
        ? s.categoryId
        : null) ??
      hint?.id ??
      doc.categories.find((c) => !c.archived)?.id ??
      "new";
    // Reused organization dishes never carry source-outlet photos or inherited prices.
    const photo = approved.some((m) => m.id === s.mediaId) ? s.mediaId : null;
    const art = artworkForDish(s.name, s.key.startsWith("catalogue:") ? s.key.slice(10) : null);
    return {
      key: s.key,
      name: s.name,
      categoryId: target,
      priceText: "",
      free: false,
      mediaId: photo,
      artworkId: art?.id ?? null,
      imageMode: photo ? "photo" : art ? "artwork" : "none",
    };
  };
  const addMany = (
    choices: Pick<Suggestion, "key" | "name" | "categoryHint" | "categoryId" | "mediaId">[]
  ) => {
    const seen = new Set(selection.map((item) => normalizeDishText(item.name)));
    const batch: QuickDish[] = [];
    for (const choice of choices) {
      const name = normalizeDishText(choice.name);
      if (!name || seen.has(name)) continue;
      if (selection.length + batch.length >= 50) break;
      seen.add(name);
      batch.push(makeQuickDish(choice));
    }
    if (!batch.length) {
      setError(
        selection.length >= 50
          ? "Maximum 50 dishes per batch."
          : "All matching dishes are already selected."
      );
      return;
    }
    setSelection((prev) => [...prev, ...batch]);
    onPendingChange(true);
    setError("");
    setActive(0);
    setQuery("");
    input.current?.focus();
  };
  const add = (s: Pick<Suggestion, "key" | "name" | "categoryHint" | "categoryId" | "mediaId">) => {
    addMany([s]);
  };
  const addBulk = () => {
    try {
      const names = batchCandidates(bulkText);
      if (!names.length) throw new Error("Enter at least one dish name.");
      if (names.length + selection.length > 50)
        throw new Error("Maximum 50 selected dishes per batch.");
      addMany(
        names.map((name) => ({
          key: "custom:" + normalizeDishText(name),
          name,
          categoryHint: "",
          categoryId: null,
          mediaId: null,
        }))
      );
      setBulkText("");
      setBulkOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check your dish list.");
    }
  };
  const update = (key: string, patch: Partial<QuickDish>) =>
    setSelection((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => {
    const next = selection.filter((row) => row.key !== key);
    setSelection(next);
    onPendingChange(next.length > 0);
  };
  const commit = () => {
    setError("");
    if (!selection.length) return;
    if (
      selection.some((row) => row.categoryId === "new") &&
      (!newSection.trim() || newSection.trim().length > 100)
    ) {
      setError("Enter a section name for the new category.");
      return;
    }
    try {
      for (const row of selection) {
        if (!row.free && !row.priceText.trim())
          throw new Error("Enter every dish price or select Free explicitly.");
        displayToMinor(row.free ? "0" : row.priceText.trim(), doc.currency);
      }
      onAdd(selection, newSection.trim());
      setSelection([]);
      onPendingChange(false);
      setReview(false);
      setQuery("");
      setNewSection("");
      setError("");
      input.current?.focus();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not add dishes. Your selection is preserved."
      );
    }
  };
  return (
    <section className="smart-composer" aria-label="Smart Dish Composer">
      <div className="smart-composer-head">
        <div>
          <span className="eyebrow">SMART COMPOSER</span>
          <h2>Add dishes to your menu</h2>
          <p>Find a familiar dish or create your own. Nothing is published automatically.</p>
        </div>
        <span className="badge">{selection.length} selected</span>
      </div>
      <div className="smart-composer-grid">
        <div className="smart-composer-search">
          <label className="field" htmlFor="smart-dish-search">
            Search the dish catalogue
          </label>
          <div className="smart-composer-input">
            <Search size={18} aria-hidden="true" />
            <input
              ref={input}
              id="smart-dish-search"
              type="search"
              autoComplete="off"
              maxLength={100}
              role="combobox"
              aria-autocomplete="list"
              aria-controls="smart-dish-options"
              aria-expanded={expanded && clean.length >= 2}
              aria-activedescendant={
                expanded && matches[active] ? "smart-option-" + active : undefined
              }
              placeholder="Try paneer, pizza, biryani..."
              value={query}
              onFocus={() => setExpanded(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setExpanded(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setExpanded(false);
                  return;
                }
                if (e.key === "ArrowDown" && matches.length) {
                  e.preventDefault();
                  setExpanded(true);
                  setActive((i) => Math.min(matches.length - 1, i + 1));
                }
                if (e.key === "ArrowUp" && matches.length) {
                  e.preventDefault();
                  setExpanded(true);
                  setActive((i) => Math.max(0, i - 1));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const hit = expanded ? matches[active] : undefined;
                  if (hit) add(hit);
                  else if (clean.length >= 2 && custom)
                    add({
                      key: "custom:" + clean,
                      name: custom,
                      categoryHint: "",
                      categoryId: null,
                      mediaId: null,
                    });
                }
              }}
            />
          </div>
          <div className="smart-productivity-actions">
            <button type="button" onClick={() => setBulkOpen((v) => !v)} aria-expanded={bulkOpen}>
              {bulkOpen ? "Close bulk entry" : "Paste a dish list"}
            </button>
            {clean.length >= 2 && matches.length > 1 && (
              <button
                type="button"
                disabled={selection.length >= 50}
                onClick={() => addMany(matches)}
              >
                Select all {matches.length} suggestions
              </button>
            )}
          </div>
          {bulkOpen && (
            <div className="smart-bulk-entry">
              <label className="field">
                Bulk dish names (one per line, comma or semicolon separated; up to 50)
                <textarea
                  aria-label="Bulk dish names"
                  rows={4}
                  maxLength={5000}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Paneer Tikka\nDal Makhani\nButter Naan"}
                />
              </label>
              <p className="quiet">
                Names only: review each price, section and optional photograph before adding to your
                private draft.
              </p>
              <button type="button" className="ember" onClick={addBulk}>
                Select pasted dishes
              </button>
            </div>
          )}
          {clean.length < 2 && (
            <div className="smart-discovery">
              {recent.length > 0 && (
                <div>
                  <strong>Recently used in this menu</strong>
                  <div className="smart-discovery-list">
                    {recent.map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        disabled={alreadySelected(item.name)}
                        onClick={() =>
                          add({
                            key: item.key,
                            name: item.name,
                            categoryHint: item.categoryHint,
                            categoryId: null,
                            mediaId: null,
                          })
                        }
                      >
                        {item.name} <span aria-hidden="true">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {organization.length > 0 && (
                <div>
                  <strong>Reuse from your accessible organization menus</strong>
                  <div className="smart-discovery-list">
                    {organization.slice(0, 8).map((item) => (
                      <button
                        type="button"
                        key={item.key}
                        disabled={alreadySelected(item.name)}
                        title={"From " + item.sourceMenu}
                        onClick={() =>
                          add({
                            key: item.key,
                            name: item.name,
                            categoryHint: item.categoryHint,
                            categoryId: null,
                            mediaId: null,
                          })
                        }
                      >
                        {item.name}
                        <small>{item.sourceMenu}</small>
                        <span aria-hidden="true">+</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {expanded && clean.length >= 2 && (
            <div
              id="smart-dish-options"
              role="listbox"
              aria-label="Dish suggestions"
              className="smart-composer-options"
            >
              {matches.map((item, i) => {
                const image = approved.some((m) => m.id === item.mediaId) ? item.mediaId : null;
                const artwork = image ? null : artworkForDish(item.name, item.key.startsWith("catalogue:") ? item.key.slice(10) : null);
                return (
                  <button
                    id={"smart-option-" + i}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    className={"smart-composer-option " + (i === active ? "is-active" : "")}
                    key={item.key}
                    disabled={alreadySelected(item.name)}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(item)}
                  >
                    <span className="smart-dish-thumb">
                      {image ? (
                        <img
                          src={"/api/media/" + encodeURIComponent(image)}
                          alt=""
                          width={46}
                          height={46}
                        />
                      ) : artwork ? (
                        <img src={artwork.path} alt="" width={46} height={46} loading="lazy" />
                      ) : (
                        <ImagePlus size={19} aria-hidden="true" />
                      )}
                    </span>
                    <span className="smart-option-name">
                      <strong>{item.name}</strong>
                      <small>
                        {item.source === "existing"
                          ? "Already in this menu · "
                          : item.source === "organization"
                            ? "From " + item.sourceMenu + " · "
                            : ""}
                        {item.categoryHint}
                      </small>
                    </span>
                    <span aria-hidden="true">{alreadySelected(item.name) ? "✓" : "+"}</span>
                  </button>
                );
              })}
              {!matches.length && (
                <p className="quiet">No curated match. You can create your own dish below.</p>
              )}
              {custom && !alreadySelected(custom) && (
                <button
                  type="button"
                  className="smart-composer-custom"
                  onClick={() =>
                    add({
                      key: "custom:" + clean,
                      name: custom,
                      categoryHint: "",
                      categoryId: null,
                      mediaId: null,
                    })
                  }
                >
                  <Plus size={16} /> Create custom dish: {custom}
                </button>
              )}
              <p className="quiet" role="status">
                {matches.length} matches. Cross-outlet reuse never carries a source price or photo.
              </p>
            </div>
          )}
          {clean.length < 2 && (
            <p className="quiet">
              Type at least two characters. Use ↑ ↓ and Enter to choose a suggestion.
            </p>
          )}
        </div>
        <aside className="smart-composer-tray" aria-label="Dish selection tray">
          <div className="row between">
            <strong>
              <ShoppingBasket size={18} aria-hidden="true" /> Selection tray
            </strong>
            <button
              type="button"
              aria-expanded={expanded}
              aria-label="Toggle composer suggestions"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Collapse" : "Expand"}
            </button>
          </div>
          {!selection.length ? (
            <p className="quiet">
              Select dishes to build a batch. Your existing menu is unchanged.
            </p>
          ) : (
            <>
              <ul className="smart-tray-items">
                {selection.map((item) => (
                  <li key={item.key}>
                    <img src={dishImageSrc(item, "private")} alt="" width={42} height={36} loading="lazy" />
                    <span>{item.name}</span>
                    <button
                      type="button"
                      aria-label={"Remove " + item.name}
                      onClick={() => remove(item.key)}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
              <button type="button" className="ember" onClick={enterReview}>
                Review &amp; Add {selection.length} {selection.length === 1 ? "dish" : "dishes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelection([]);
                  onPendingChange(false);
                  setReview(false);
                }}
              >
                Clear selection
              </button>
            </>
          )}
        </aside>
      </div>
      {review && selection.length > 0 && (
        <div ref={reviewRef} key={reviewPulse} className="smart-review smart-review-arrival" aria-label="Review selected dishes" aria-live="polite">
          <div className="row between">
            <h3 tabIndex={-1} ref={reviewHeading}>Review prices, categories &amp; photographs</h3>
            <button type="button" onClick={() => setReview(false)}>
              Close review
            </button>
          </div>
          <p>
            Prices belong to this restaurant. Uploaded photos are private until you explicitly save
            and publish the menu.
          </p>
          {selection.map((item, i) => (
            <div className="smart-review-row" key={item.key}>
              <div className="row between">
                <strong>
                  {i + 1}. {item.name}
                </strong>
                <button
                  type="button"
                  aria-label={"Remove " + item.name}
                  onClick={() => remove(item.key)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="smart-review-fields">
                <label className="field">
                  Price ({doc.currency})
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label={"Quick price for " + item.name}
                    disabled={item.free}
                    placeholder="Required"
                    value={item.free ? "0" : item.priceText}
                    onChange={(e) => update(item.key, { priceText: e.target.value })}
                  />
                </label>
                <label className="field">
                  Section
                  <select
                    aria-label={"Quick section for " + item.name}
                    value={item.categoryId}
                    onChange={(e) => update(item.key, { categoryId: e.target.value })}
                  >
                    {doc.categories
                      .filter((c) => !c.archived)
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    <option value="new">+ Create a new section</option>
                  </select>
                </label>
                <label className="field">
                  Dish image
                  <select
                    aria-label={"Quick photo for " + item.name}
                    value={item.imageMode === "photo" ? "photo:" + (item.mediaId ?? "") : item.imageMode}
                    onChange={(e) => {
                      const value = e.target.value;
                      const art = artworkById(item.artworkId) ?? artworkForDish(item.name);
                      if (value.startsWith("photo:")) update(item.key, { mediaId: value.slice(6), imageMode: "photo" });
                      else if (value === "artwork" && art) update(item.key, { artworkId: art.id, imageMode: "artwork", mediaId: null });
                      else update(item.key, { imageMode: "none", mediaId: null });
                    }}
                  >
                    {(artworkById(item.artworkId) ?? artworkForDish(item.name)) && <option value="artwork">Curated illustration · default</option>}
                    <option value="none">No image</option>
                    {approved.map((photo, index) => (
                      <option value={"photo:" + photo.id} key={photo.id}>Approved photo {index + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="row smart-free">
                <input
                  type="checkbox"
                  checked={item.free}
                  onChange={(e) =>
                    update(item.key, {
                      free: e.target.checked,
                      priceText: e.target.checked ? "" : item.priceText,
                    })
                  }
                />{" "}
                This item is free
              </label>
              <div className="smart-artwork-hint">
                <img src={dishImageSrc(item, "private")} alt="" width={72} height={60} loading="lazy" />
                <span>{item.imageMode === "artwork" ? "Curated illustration selected. Replace it with an approved restaurant photograph whenever you like." : item.imageMode === "photo" ? "Your selected photograph replaces the illustration." : "No image selected. You can add one later."}</span>
              </div>
              {approved.length > 0 && (
                <div className="smart-upload-picker">
                  <button
                    type="button"
                    aria-expanded={photoPickerKey === item.key}
                    onClick={() => {
                      setPhotoPickerKey((k) => (k === item.key ? null : item.key));
                      setPhotoLimit(24);
                    }}
                  >
                    {photoPickerKey === item.key
                      ? "Close photo gallery"
                      : "Browse " + approved.length + " approved uploaded photos"}
                  </button>
                  {photoPickerKey === item.key && (
                    <div className="smart-upload-gallery">
                      {approved.slice(0, photoLimit).map((photo, index) => (
                        <button
                          type="button"
                          key={photo.id}
                          className={photo.id === item.mediaId && item.imageMode === "photo" ? "is-selected" : ""}
                          aria-pressed={photo.id === item.mediaId && item.imageMode === "photo"}
                          aria-label={"Use approved photo " + (index + 1) + " for " + item.name}
                          onClick={() => update(item.key, { mediaId: photo.id, imageMode: "photo" })}
                        >
                          <img
                            src={"/api/media/" + encodeURIComponent(photo.id)}
                            alt=""
                            width={76}
                            height={60}
                            loading="lazy"
                          />
                          <span>Photo {index + 1}</span>
                        </button>
                      ))}
                      {approved.length > photoLimit && (
                        <button
                          type="button"
                          onClick={() => setPhotoLimit((n) => Math.min(n + 24, approved.length))}
                        >
                          Show more photographs
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {item.imageMode === "photo" && item.mediaId && approved.some((m) => m.id === item.mediaId) && (
                <span className="smart-photo-preview">
                  <img
                    src={"/api/media/" + encodeURIComponent(item.mediaId)}
                    alt={"Selected uploaded photo for " + item.name}
                    width={84}
                    height={70}
                  />
                </span>
              )}
            </div>
          ))}
          {selection.some((row) => row.categoryId === "new") && (
            <label className="field">
              New section name (created only when you select Add to draft)
              <input
                value={newSection}
                maxLength={100}
                onChange={(e) => setNewSection(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <div className="row between">
            <button type="button" onClick={() => setReview(false)}>
              Add more dishes
            </button>
            <button type="button" className="ember ink-press" onClick={commit}>
              Add {selection.length} to private draft
            </button>
          </div>
        </div>
      )}
      {!review && error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
