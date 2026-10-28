"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Search, X } from "lucide-react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { formatPrice } from "@/lib/utils";
import { startingPriceMinor } from "@/modules/menu-product/public-presentation";
import { dishImageSrc } from "@/modules/menu-product/dish-artwork";
import { normalizeDishText } from "@/modules/menu-product/dish-intelligence";
import { StudioDishEditor } from "./studio-dish-editor";

/* Private, client-side draft only. No card interaction publishes a menu. */
type Category = MenuDocument["categories"][number];
type Dish = Category["items"][number];
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };

function findEditingDish(doc: MenuDocument, editingId: string | null) {
  if (!editingId) return null;
  for (const [categoryIndex, category] of doc.categories.entries()) {
    const dishIndex = category.items.findIndex((dish) => dish.id === editingId);
    const dish = category.items[dishIndex];
    if (dishIndex >= 0 && dish) return { categoryIndex, dishIndex, dish };
  }
  return null;
}

export function StudioMenuBoard({
  doc,
  currency,
  media,
  canWrite,
  onAddDish,
  onAddMultiple,
  onPendingChange,
  onCreateSection,
  onUpdateCategory,
  onUpdateDish,
  onMoveDish,
  onMoveSection,
}: {
  doc: MenuDocument;
  currency: string;
  media: Media[];
  canWrite: boolean;
  onAddDish: (categoryId: string) => void;
  onAddMultiple: () => void;
  onPendingChange: (pending: boolean) => void;
  onCreateSection: (name: string) => void;
  onUpdateCategory: (index: number, patch: Partial<Category>) => void;
  onUpdateDish: (categoryIndex: number, dishIndex: number, patch: Partial<Dish>) => void;
  onMoveDish: (categoryIndex: number, dishIndex: number, delta: number) => void;
  onMoveSection: (categoryIndex: number, delta: number) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSection, setNewSection] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editArchived, setEditArchived] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionError, setSectionError] = useState("");
  const editorDialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const categories = doc.categories
    .map((category, categoryIndex) => ({ category, categoryIndex }))
    .filter(({ category }) => showArchived || !category.archived);
  const editing = findEditingDish(doc, editingId);
  useEffect(() => {
    const dialog = editorDialog.current;
    if (editing && dialog && !dialog.open) dialog.showModal();
    if (!editing && dialog?.open) dialog.close();
  }, [editing]);
  useEffect(() => {
    if (newSection) input.current?.focus();
  }, [newSection]);
  useEffect(() => {
    onPendingChange(newSection || editingSection !== null);
    return () => onPendingChange(false);
  }, [newSection, editingSection, onPendingChange]);

  function addSection() {
    const name = sectionName.trim();
    if (!name || name.length > 100) {
      setSectionError("Give the section a name of up to 100 characters.");
      return;
    }
    if (
      doc.categories.some(
        (c) => !c.archived && normalizeDishText(c.name) === normalizeDishText(name)
      )
    ) {
      setSectionError("This section already exists.");
      return;
    }
    if (doc.categories.length >= 100) {
      setSectionError("This menu has reached its section limit.");
      return;
    }
    onCreateSection(name);
    setNewSection(false);
    setSectionName("");
    setSectionError("");
  }

  return (
    <section className="menu-board" aria-label="Visual menu board">
      <div className="menu-board-heading">
        <div>
          <span className="atelier-eyebrow">YOUR EDITABLE MENU</span>
          <h2>Sections &amp; dishes</h2>
          <p className="atelier-supporting-text">
            Build your menu visually. Changes stay private until you save and publish.
          </p>
        </div>
        <div className="menu-board-actions">
          <button type="button" onClick={onAddMultiple} disabled={!canWrite}>
            Add multiple
          </button>
          <button
            type="button"
            className="ember ink-press"
            onClick={() => onAddDish("")}
            disabled={!canWrite}
          >
            <Plus size={18} aria-hidden="true" /> Add dish
          </button>
        </div>
      </div>
      <div className="menu-board-toolbar">
        <label className="menu-board-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Find a dish</span>
          <input
            value={query}
            type="search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dishes or sections"
          />
        </label>
        <nav className="menu-board-filters" aria-label="Filter sections">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            All
          </button>
          {categories.map(({ category }) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={filter === category.id}
              onClick={() => setFilter(category.id)}
            >
              {category.name}
            </button>
          ))}
        </nav>
        <label className="menu-board-archived">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      <div className="menu-board-sections">
        {categories
          .filter(
            ({ category }) =>
              (filter === "all" || filter === category.id) &&
              (!query.trim() ||
                [
                  category.name,
                  category.description,
                  ...category.items.flatMap((d) => [d.name, d.description]),
                ].some((value) => normalizeDishText(value).includes(normalizeDishText(query))))
          )
          .map(({ category, categoryIndex }) => {
            const visible = category.items
              .map((dish, dishIndex) => ({ dish, dishIndex }))
              .filter(
                ({ dish }) =>
                  (showArchived || !dish.archived) &&
                  (!query.trim() ||
                    [dish.name, dish.description, category.name].some((v) =>
                      normalizeDishText(v).includes(normalizeDishText(query))
                    ))
              );
            return (
              <section className="menu-board-section" key={category.id} aria-label={category.name}>
                <div className="menu-board-section-heading">
                  <div>
                    <span className="atelier-eyebrow">SECTION {categoryIndex + 1}</span>
                    <h3>{category.name}</h3>
                    {category.description && <p>{category.description}</p>}
                    {category.archived && (
                      <span className="menu-board-status">Archived section</span>
                    )}
                  </div>
                  <div className="menu-board-section-actions">
                    <span>{visible.length} dishes</span>
                    <button type="button" aria-label={"Move section " + category.name + " up"}
                      disabled={!canWrite || categoryIndex === 0}
                      onClick={() => onMoveSection(categoryIndex, -1)}>
                      <ArrowUp size={16} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={"Move section " + category.name + " down"}
                      disabled={!canWrite || categoryIndex === doc.categories.length - 1}
                      onClick={() => onMoveSection(categoryIndex, 1)}>
                      <ArrowDown size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={"Edit section " + category.name}
                      disabled={!canWrite}
                      onClick={() => {
                        setEditingSection(editingSection === category.id ? null : category.id);
                        setEditName(category.name);
                        setEditDescription(category.description);
                        setEditArchived(category.archived);
                        setSectionError("");
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title={"Add dish to " + category.name}
                      aria-label={"Add dish to " + category.name}
                      onClick={() => onAddDish(category.id)}
                      disabled={!canWrite || category.archived}
                    >
                      <Plus size={17} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {editingSection === category.id && (
                  <div className="menu-board-section-edit">
                    <label className="field">
                      Section name
                      <input
                        value={editName}
                        maxLength={100}
                        onChange={(event) => {
                          setEditName(event.target.value);
                          setSectionError("");
                        }}
                      />
                    </label>
                    <label className="field">
                      Description
                      <input
                        value={editDescription}
                        maxLength={1000}
                        onChange={(event) => setEditDescription(event.target.value)}
                      />
                    </label>
                    <label className="menu-board-free">
                      <input
                        type="checkbox"
                        checked={editArchived}
                        onChange={(event) => setEditArchived(event.target.checked)}
                      />
                      Archived section
                    </label>
                    {sectionError && <p role="alert">{sectionError}</p>}
                    <button
                      type="button"
                      className="ember"
                      onClick={() => {
                        const name = editName.trim();
                        if (
                          !name ||
                          doc.categories.some(
                            (c) =>
                              c.id !== category.id &&
                              !c.archived &&
                              normalizeDishText(c.name) === normalizeDishText(name)
                          )
                        ) {
                          setSectionError("Enter a distinct section name.");
                          return;
                        }
                        onUpdateCategory(categoryIndex, {
                          name,
                          description: editDescription,
                          archived: editArchived,
                        });
                        if (editArchived) setShowArchived(true);
                        setEditingSection(null);
                      }}
                    >
                      Apply section changes
                    </button>
                    <button type="button" onClick={() => setEditingSection(null)}>
                      Cancel
                    </button>
                  </div>
                )}
                {visible.length ? (
                  <div className="menu-board-grid">
                    {visible.map(({ dish, dishIndex }) => (
                      <article className="menu-board-dish" key={dish.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- Private media is outlet-scoped. */}
                        <img
                          className="menu-board-dish-art"
                          src={dishImageSrc(dish, "private")}
                          alt=""
                          width={108}
                          height={108}
                          loading="lazy"
                        />
                        <div className="menu-board-dish-copy">
                          <strong>{dish.name}</strong>
                          {dish.description && <p>{dish.description}</p>}
                          <span className="menu-board-price">
                            {dish.variants.length ? "From " : ""}
                            {formatPrice(startingPriceMinor(dish), currency)}
                          </span>
                          {(dish.soldOut || dish.archived) && (
                            <small className="menu-board-status">
                              {dish.archived ? "Archived" : "Sold out"}
                            </small>
                          )}
                        </div>
                        <div className="menu-board-dish-actions">
                          <button
                            type="button"
                            aria-label={"Edit " + dish.name}
                            title={"Edit " + dish.name}
                            onClick={() => setEditingId(dish.id)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            aria-label={"Move " + dish.name + " up"}
                            title="Move up"
                            disabled={!canWrite || dishIndex === 0}
                            onClick={() => onMoveDish(categoryIndex, dishIndex, -1)}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={"Move " + dish.name + " down"}
                            title="Move down"
                            disabled={!canWrite || dishIndex === category.items.length - 1}
                            onClick={() => onMoveDish(categoryIndex, dishIndex, 1)}
                          >
                            <ArrowDown size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="menu-board-empty">No matching dishes in this section.</p>
                )}
              </section>
            );
          })}
      </div>
      <div className="menu-board-footer">
        {newSection ? (
          <div className="menu-board-new-section">
            <label className="field">
              Section name
              <input
                ref={input}
                maxLength={100}
                value={sectionName}
                onChange={(event) => {
                  setSectionName(event.target.value);
                  setSectionError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSection();
                  }
                }}
              />
            </label>
            {sectionError && <p role="alert">{sectionError}</p>}
            <button type="button" className="ember" onClick={addSection}>
              Create section
            </button>
            <button
              type="button"
              onClick={() => {
                setNewSection(false);
                setSectionError("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setNewSection(true)} disabled={!canWrite}>
            <Plus size={17} aria-hidden="true" /> New section
          </button>
        )}
      </div>
      <dialog
        ref={editorDialog}
        className="menu-board-dialog menu-board-editor-dialog"
        aria-label={editing ? "Edit " + editing.dish.name : "Edit dish"}
        onClose={() => setEditingId(null)}
      >
        <div className="menu-board-dialog-head">
          <div>
            <span className="atelier-eyebrow">PRIVATE DISH EDITOR</span>
            <h2>{editing?.dish.name ?? "Edit dish"}</h2>
          </div>
          <button
            type="button"
            aria-label="Close dish editor"
            onClick={() => editorDialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        <div className="menu-board-dialog-body">
          {editing && (
            <StudioDishEditor
              dish={editing.dish}
              ci={editing.categoryIndex}
              di={editing.dishIndex}
              dishCount={doc.categories[editing.categoryIndex]?.items.length ?? 0}
              canWrite={canWrite}
              currency={currency}
              media={media}
              companionDishes={doc.categories
                .filter((c) => !c.archived)
                .flatMap((c) =>
                  c.items.filter((d) => !d.archived).map((d) => ({ id: d.id, name: d.name }))
                )}
              onUpdate={(patch) => onUpdateDish(editing.categoryIndex, editing.dishIndex, patch)}
              onMove={(delta) => onMoveDish(editing.categoryIndex, editing.dishIndex, delta)}
            />
          )}
        </div>
        <div className="menu-board-dialog-foot">
          <button type="button" onClick={() => editorDialog.current?.close()}>
            Done editing
          </button>
          <span>Save draft when ready · Guests see only published changes</span>
        </div>
      </dialog>
    </section>
  );
}
