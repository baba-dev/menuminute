"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, Search, ShoppingBasket, X } from "lucide-react";
import { displayToMinor } from "@/lib/money";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { existingFromDocument, normalizeDishText, rankDishSuggestions, type Suggestion } from "@/modules/menu-product/dish-intelligence";

type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
export type QuickDish = { key: string; name: string; categoryId: string; priceText: string; free: boolean; mediaId: string | null };
export function SmartDishComposer({ doc, outletId, menuId, media, defaultCategoryId, focusRequest, onAdd, onPendingChange }: {
  doc: MenuDocument; outletId: string; menuId: string; media: Media[];
  defaultCategoryId: string; focusRequest: number;
  onAdd: (dishes: QuickDish[], newSectionName: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState<QuickDish[]>([]);
  const [review, setReview] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [active, setActive] = useState(0);
  const [newSection, setNewSection] = useState("");
  const [category, setCategory] = useState(defaultCategoryId);
  const [error, setError] = useState("");
  const approved = media.filter(m => m.status === "ready" && !!m.approvedAt);
  useEffect(() => {
    if (!focusRequest) return;
    setCategory(defaultCategoryId);
    setExpanded(true);
    setReview(false);
    input.current?.focus();
  }, [focusRequest, defaultCategoryId]);
  const existing = useMemo(() => existingFromDocument(doc, outletId, menuId), [doc, outletId, menuId]);
  const matches = useMemo(() => rankDishSuggestions({ query, outletId, menuId, existing, limit: 7 }), [query, outletId, menuId, existing]);
  const clean = normalizeDishText(query);
  const custom = query.trim().slice(0, 100);
  const alreadySelected = (name: string) => selection.some(s => normalizeDishText(s.name) === normalizeDishText(name));
  const add = (s: Pick<Suggestion, "key" | "name" | "categoryHint" | "categoryId" | "mediaId">) => {
    if (alreadySelected(s.name)) return;
    const hint = doc.categories.find(c => !c.archived && normalizeDishText(c.name) === normalizeDishText(s.categoryHint));
    const target = (category && doc.categories.some(c => c.id === category && !c.archived) ? category : null) ??
      (s.categoryId && doc.categories.some(c => c.id === s.categoryId && !c.archived) ? s.categoryId : null) ??
      hint?.id ?? doc.categories.find(c => !c.archived)?.id ?? "new";
    const photo = approved.some(m => m.id === s.mediaId) ? s.mediaId : null;
    setSelection(prev => [...prev, { key: s.key, name: s.name, categoryId: target, priceText: "", free: false, mediaId: photo }]);
    onPendingChange(true);
    setError("");
    setActive(0);
    setQuery("");
    input.current?.focus();
  };
  const update = (key: string, patch: Partial<QuickDish>) => setSelection(rows =>
    rows.map(row => row.key === key ? { ...row, ...patch } : row));
  const remove = (key: string) => {
    const next = selection.filter(row => row.key !== key);
    setSelection(next); onPendingChange(next.length > 0);
  };
  const commit = () => {
    setError("");
    if (!selection.length) return;
    if (selection.some(row => row.categoryId === "new") && (!newSection.trim() || newSection.trim().length > 100)) {
      setError("Enter a section name for the new category."); return;
    }
    try {
      for (const row of selection) {
        if (!row.free && !row.priceText.trim()) throw new Error("Enter every dish price or select Free explicitly.");
        displayToMinor(row.free ? "0" : row.priceText.trim(), doc.currency);
      }
      onAdd(selection, newSection.trim());
      setSelection([]); onPendingChange(false); setReview(false); setQuery(""); setNewSection(""); setError("");
      input.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add dishes. Your selection is preserved.");
    }
  };
  return (
    <section className="smart-composer" aria-label="Smart Dish Composer">
      <div className="smart-composer-head">
        <div><span className="eyebrow">SMART COMPOSER</span><h2>Add dishes to your menu</h2>
          <p>Find a familiar dish or create your own. Nothing is published automatically.</p></div>
        <span className="badge">{selection.length} selected</span>
      </div>
      <div className="smart-composer-grid">
        <div className="smart-composer-search">
          <label className="field" htmlFor="smart-dish-search">Search the dish catalogue</label>
          <div className="smart-composer-input"><Search size={18} aria-hidden="true" />
            <input ref={input} id="smart-dish-search" type="search" autoComplete="off" maxLength={100}
              role="combobox" aria-autocomplete="list" aria-controls="smart-dish-options"
              aria-expanded={expanded && clean.length >= 2} aria-activedescendant={expanded && matches[active] ? "smart-option-" + active : undefined}
              placeholder="Try paneer, pizza, biryani..." value={query}
              onFocus={() => setExpanded(true)}
              onChange={e => { setQuery(e.target.value); setActive(0); setExpanded(true); }}
              onKeyDown={e => {
                if (e.key === "Escape") { setExpanded(false); return; }
                if (e.key === "ArrowDown" && matches.length) { e.preventDefault(); setExpanded(true); setActive(i => Math.min(matches.length - 1,i+1)); }
                if (e.key === "ArrowUp" && matches.length) { e.preventDefault(); setExpanded(true); setActive(i => Math.max(0,i-1)); }
                if (e.key === "Enter") {
                  e.preventDefault();
                  const hit = expanded ? matches[active] : undefined;
                  if (hit) add(hit);
                  else if (clean.length >= 2 && custom) add({key:"custom:"+clean,name:custom,categoryHint:"",categoryId:null,mediaId:null});
                }
              }} />
          </div>
          {expanded && clean.length >= 2 && (
            <div id="smart-dish-options" role="listbox" aria-label="Dish suggestions" className="smart-composer-options">
              {matches.map((item,i) => {
                const image = approved.some(m => m.id === item.mediaId) ? item.mediaId : null;
                return <button id={"smart-option-"+i} role="option" aria-selected={i===active} type="button"
                  className={"smart-composer-option " + (i===active?"is-active":"")} key={item.key}
                  disabled={alreadySelected(item.name)} onMouseEnter={() => setActive(i)} onClick={() => add(item)}>
                  <span className="smart-dish-thumb">{image ?
                    <img src={"/api/media/"+encodeURIComponent(image)} alt="" width={46} height={46} /> :
                    <ImagePlus size={19} aria-hidden="true" />}</span>
                  <span className="smart-option-name"><strong>{item.name}</strong><small>{item.source==="existing"?"Already in this menu · ":""}{item.categoryHint}</small></span>
                  <span aria-hidden="true">{alreadySelected(item.name)?"✓":"+"}</span>
                </button>;
              })}
              {!matches.length && <p className="quiet">No curated match. You can create your own dish below.</p>}
              {custom && !alreadySelected(custom) &&
                <button type="button" className="smart-composer-custom" onClick={() =>
                  add({ key:"custom:"+clean, name:custom, categoryHint:"",categoryId:null,mediaId:null })}>
                  <Plus size={16} /> Create custom dish: {custom}
                </button>}
              <p className="quiet" role="status">{matches.length} catalogue/menu matches. Uploaded photographs appear only where explicitly assigned.</p>
            </div>
          )}
          {clean.length < 2 && <p className="quiet">Type at least two characters. Use ↑ ↓ and Enter to choose a suggestion.</p>}
        </div>
        <aside className="smart-composer-tray" aria-label="Dish selection tray">
          <div className="row between"><strong><ShoppingBasket size={18} aria-hidden="true"/> Selection tray</strong>
            <button type="button" aria-expanded={expanded} aria-label="Toggle composer suggestions"
              onClick={() => setExpanded(v => !v)}>{expanded?"Collapse":"Expand"}</button></div>
          {!selection.length ? <p className="quiet">Select dishes to build a batch. Your existing menu is unchanged.</p> :
            <><ul className="smart-tray-items">{selection.map(item =>
              <li key={item.key}><span>{item.name}</span><button type="button"
                aria-label={"Remove "+item.name} onClick={() => remove(item.key)}><X size={15}/></button></li>
            )}</ul><button type="button" className="ember" onClick={() => setReview(true)}>
                Review &amp; Add {selection.length} {selection.length===1?"dish":"dishes"}
              </button><button type="button" onClick={() => {
                setSelection([]); onPendingChange(false); setReview(false);
              }}>Clear selection</button></>}
        </aside>
      </div>
      {review && selection.length > 0 && <div className="smart-review" aria-label="Review selected dishes">
        <div className="row between"><h3>Review prices, categories &amp; photographs</h3>
          <button type="button" onClick={() => setReview(false)}>Close review</button></div>
        <p>Prices belong to this restaurant. Uploaded photos are private until you explicitly save and publish the menu.</p>
        {selection.map((item,i) => <div className="smart-review-row" key={item.key}>
          <div className="row between"><strong>{i+1}. {item.name}</strong>
            <button type="button" aria-label={"Remove "+item.name} onClick={() => remove(item.key)}><X size={16}/></button></div>
          <div className="smart-review-fields">
            <label className="field">Price ({doc.currency})
              <input type="text" inputMode="decimal" aria-label={"Quick price for "+item.name}
                disabled={item.free} placeholder="Required" value={item.free?"0":item.priceText}
                onChange={e=>update(item.key,{priceText:e.target.value})} />
            </label>
            <label className="field">Section
              <select aria-label={"Quick section for "+item.name} value={item.categoryId}
                onChange={e=>update(item.key,{categoryId:e.target.value})}>
                {doc.categories.filter(c=>!c.archived).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}
                <option value="new">+ Create a new section</option>
              </select>
            </label>
            <label className="field">Approved dish photo (optional)
              <select aria-label={"Quick photo for "+item.name} value={item.mediaId??""}
                onChange={e=>update(item.key,{mediaId:e.target.value||null})}>
                <option value="">No assigned photo</option>
                {approved.map((photo,index)=><option value={photo.id} key={photo.id}>Approved photo {index+1}</option>)}
              </select>
            </label>
          </div>
          <label className="row smart-free"><input type="checkbox" checked={item.free}
            onChange={e=>update(item.key,{free:e.target.checked,priceText:e.target.checked?"":item.priceText})}/> This item is free</label>
          {item.mediaId && approved.some(m=>m.id===item.mediaId) && <span className="smart-photo-preview">
            <img src={"/api/media/"+encodeURIComponent(item.mediaId)} alt={"Selected uploaded photo for "+item.name}
              width={84} height={70}/></span>}
        </div>)}
        {selection.some(row=>row.categoryId==="new") && <label className="field">
          New section name (created only when you select Add to draft)
          <input value={newSection} maxLength={100} onChange={e=>setNewSection(e.target.value)} />
        </label>}
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row between"><button type="button" onClick={()=>setReview(false)}>Add more dishes</button>
          <button type="button" className="ember ink-press" onClick={commit}>Add {selection.length} to private draft</button></div>
      </div>}
      {!review && error && <p role="alert" className="error">{error}</p>}
    </section>
  );
}
