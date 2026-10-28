"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Sparkles, X } from "lucide-react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { artworkForDish } from "@/modules/menu-product/dish-artwork";
import { displayToMinor } from "@/lib/money";
import {
  existingFromDocument,
  findCulinaryProfile,
  findPublicDishDescription,
  normalizeDishText,
  rankDishSuggestions,
  type OrganizationDish,
} from "@/modules/menu-product/dish-intelligence";
import type { QuickDish } from "./smart-dish-composer";

export function StudioAddDish({
  open,
  doc,
  menuId,
  outletId,
  organization,
  defaultCategoryId,
  onClose,
  onAdd,
}: {
  open: boolean;
  doc: MenuDocument;
  menuId: string;
  outletId: string;
  organization: OrganizationDish[];
  defaultCategoryId: string;
  onClose: () => void;
  onAdd: (dishes: QuickDish[], newSectionName: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editedDescription, setEditedDescription] = useState(false);
  const [price, setPrice] = useState("");
  const [free, setFree] = useState(false);
  const [sectionId, setSectionId] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [error, setError] = useState("");
  const existing = useMemo(() => existingFromDocument(doc, outletId, menuId), [doc, outletId, menuId]);
  const results = useMemo(() => rankDishSuggestions({
    query: name, outletId, menuId, existing, organization, limit: 6,
  }), [name, outletId, menuId, existing, organization]);
  const profile = useMemo(() => findCulinaryProfile(name), [name]);
  const referenceDescription = useMemo(() => findPublicDishDescription(name), [name]);
  const sections = doc.categories.filter((c) => !c.archived);
  useEffect(() => {
    if (open && !dialog.current?.open) {
      setName("");
      setDescription("");
      setEditedDescription(false);
      setPrice("");
      setFree(false);
      setSectionId(sections.some((c) => c.id === defaultCategoryId) ? defaultCategoryId : sections[0]?.id ?? "new");
      setSectionName("Main Menu");
      setError("");
      dialog.current?.showModal();
      requestAnimationFrame(() => input.current?.focus());
    } else if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  // Only reset when the dialog is opened; do not erase in-progress edits on parent document changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function choose(nameValue: string, hint: string) {
    setName(nameValue);
    setDescription(findPublicDishDescription(nameValue));
    setEditedDescription(false);
    const exact = sections.find((c) => normalizeDishText(c.name) === normalizeDishText(hint));
    if (exact && !defaultCategoryId) setSectionId(exact.id);
    if (!sections.length) setSectionName(hint || "Main Menu");
    setError("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) { setError("Enter a dish name."); return; }
    if (clean.length > 100) { setError("Dish names can be at most 100 characters."); return; }
    if (!free && !price.trim()) { setError("Enter this outlet's price or select Free."); return; }
    try {
      displayToMinor(free ? "0" : price, doc.currency);
      const target = sectionId || (sections[0]?.id ?? "new");
      if (target === "new" && (!sectionName.trim() || sectionName.trim().length > 100))
        throw new Error("Enter a section name of up to 100 characters.");
      const artwork = artworkForDish(clean);
      onAdd([{
        key: "custom:" + normalizeDishText(clean),
        name: clean,
        categoryId: target,
        description: editedDescription ? description : (description || referenceDescription),
        priceText: price,
        free,
        mediaId: null,
        artworkId: artwork?.id ?? null,
        imageMode: artwork ? "artwork" : "none",
      }], sectionName.trim());
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add this dish.");
    }
  }

  return (
    <dialog ref={dialog} className="menu-board-dialog menu-board-add-dialog"
      aria-labelledby="menu-board-add-title" onClose={onClose}>
      <div className="menu-board-dialog-head">
        <div><span className="atelier-eyebrow">ONE BEAUTIFUL STEP AT A TIME</span>
          <h2 id="menu-board-add-title">Add a dish</h2>
          <p>Start with its name. We fill in editable reference details when available.</p>
        </div>
        <button type="button" aria-label="Close dish creator" onClick={() => dialog.current?.close()}>
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} className="menu-board-dialog-body menu-board-add-form">
        <label className="field">Dish name
          <span className="menu-board-search"><Search size={18} aria-hidden="true" />
            <input ref={input} autoComplete="off" type="search" maxLength={100}
              placeholder="Try Paneer Tikka, Masala Dosa..." value={name}
              onChange={(event) => {
                const next = event.target.value;
                setName(next);
                if (!editedDescription) setDescription(findPublicDishDescription(next));
                setError("");
              }} required />
          </span>
        </label>
        {name.trim().length >= 2 && results.length > 0 && (
          <div className="menu-board-suggestions" aria-label="Suggested dishes">
            {results.map((result) => (
              <button key={result.key} type="button" onClick={() => choose(result.name, result.categoryHint)}
                disabled={result.source === "existing"}>
                <span>{result.name}<small>{result.source === "existing" ? "Already in menu" : result.categoryHint}</small></span>
                <Plus size={17} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
        {referenceDescription && <p className="menu-board-reference-note">
          <Sparkles size={17} aria-hidden="true" /> Curated dish description suggested — review it for your recipe.
        </p>}
        <label className="field">Public description <small>Editable suggestion · optional</small>
          <textarea maxLength={1000} rows={3} value={description}
            placeholder="Describe this dish to your guests"
            onChange={(event) => { setDescription(event.target.value); setEditedDescription(true); }} />
        </label>
        {profile && (
          <p className="menu-board-reference-note"><Sparkles size={17} aria-hidden="true" />
            {profile.name}: culinary, ingredients and nutrition reference values will be added as unverified suggestions.
          </p>
        )}
        <div className="menu-board-add-fields">
          <label className="field">Price ({doc.currency})
            <input inputMode="decimal" type="text" value={free ? "0" : price} disabled={free}
              placeholder="Required" onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label className="field">Section
            <select value={sectionId} onChange={(event) => setSectionId(event.target.value)}>
              {sections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="new">+ New section</option>
            </select>
          </label>
        </div>
        <label className="menu-board-free">
          <input type="checkbox" checked={free} onChange={(event) => setFree(event.target.checked)} />
          This dish is free
        </label>
        {sectionId === "new" && <label className="field">New section name
          <input value={sectionName} maxLength={100} onChange={(event) => setSectionName(event.target.value)} required />
        </label>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="menu-board-add-bottom">
          <p>Added to your private draft. Publishing is always separate.</p>
          <button type="submit" className="ember ink-press"><Plus size={17} /> Add to draft</button>
        </div>
      </form>
    </dialog>
  );
}
