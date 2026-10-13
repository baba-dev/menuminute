"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";
import type { MenuCategory, MenuItem } from "@/db/schema";
import {
  Plus,
  Trash2,
  Flame,
  Leaf,
  Sparkles,
  Layers,
  UtensilsCrossed,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface MenuManagerProps {
  initialCategories: MenuCategory[];
  initialItems: MenuItem[];
  currency: string;
}

export function MenuManager({ initialCategories, initialItems, currency }: MenuManagerProps) {
  const [categories, setCategories] = useState<MenuCategory[]>(initialCategories);
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    initialCategories[0]?.id || ""
  );

  // Modal States
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add Category Form
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");

  // Add Item Form
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemIsVeg, setItemIsVeg] = useState(true);
  const [itemSpiceLevel, setItemSpiceLevel] = useState(0);
  const [itemIsFeatured, setItemIsFeatured] = useState(false);

  // Handle Category Creation
  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName.trim(),
          description: categoryDescription.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create category");
      const newCat = (await res.json()) as MenuCategory;

      setCategories((prev) => [...prev, newCat]);
      setSelectedCategoryId(newCat.id);
      setCategoryName("");
      setCategoryDescription("");
      setShowAddCategory(false);
      toast.success(`Category "${newCat.name}" added successfully`);
    } catch {
      toast.error("Failed to add category");
    } finally {
      setLoading(false);
    }
  }

  // Handle Item Creation
  async function handleCreateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !itemPrice || !selectedCategoryId) return;

    setLoading(true);
    try {
      const res = await fetch("/api/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategoryId,
          name: itemName.trim(),
          description: itemDescription.trim() || undefined,
          priceRupees: parseFloat(itemPrice),
          isVeg: itemIsVeg,
          spiceLevel: itemSpiceLevel,
          isFeatured: itemIsFeatured,
        }),
      });

      if (!res.ok) throw new Error("Failed to create item");
      const newItem = (await res.json()) as MenuItem;

      setItems((prev) => [...prev, newItem]);
      setItemName("");
      setItemDescription("");
      setItemPrice("");
      setItemSpiceLevel(0);
      setItemIsFeatured(false);
      setShowAddItem(false);
      toast.success(`Dish "${newItem.name}" added to menu`);
    } catch {
      toast.error("Failed to create menu item");
    } finally {
      setLoading(false);
    }
  }

  // Handle Item Deletion
  async function handleDeleteItem(itemId: string, name: string) {
    if (!confirm(`Are you sure you want to remove "${name}"?`)) return;

    try {
      const res = await fetch(`/api/menu/items/${itemId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete item");

      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success(`Item "${name}" removed`);
    } catch {
      toast.error("Failed to delete item");
    }
  }

  // Filter items by active category
  const filteredItems = items.filter((item) => item.categoryId === selectedCategoryId);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Menu Management</h1>
          <p className="mt-1 text-xs text-stone-500">
            Real-time SQLite vertical slice. Add, edit, and organize dishes on your public menu.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCategory(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>New Category</span>
          </button>

          <button
            onClick={() => setShowAddItem(true)}
            disabled={categories.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Categories Horizontal Tabs */}
      <div className="no-scrollbar overflow-x-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-2">
          {categories.length === 0 ? (
            <p className="px-2 py-1 text-xs text-stone-400">
              No categories yet. Create one to begin!
            </p>
          ) : (
            categories.map((cat) => {
              const count = items.filter((i) => i.categoryId === cat.id).length;
              const isSelected = cat.id === selectedCategoryId;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? "bg-orange-600 text-white shadow-xs"
                      : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  <span>{cat.name}</span>
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isSelected ? "bg-orange-700 text-white" : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center shadow-xs">
            <UtensilsCrossed className="mx-auto mb-2 h-10 w-10 text-stone-300" />
            <h3 className="text-sm font-semibold text-stone-800">No dishes in this category</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-stone-500">
              Add your first dish to this category using the &quot;Add Menu Item&quot; button above.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full border ${
                          item.isVeg
                            ? "border-emerald-700 bg-emerald-600"
                            : "border-red-700 bg-red-600"
                        }`}
                        title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                      />
                      <h3 className="text-sm leading-tight font-bold text-stone-900">
                        {item.name}
                      </h3>
                    </div>

                    <span className="shrink-0 text-sm font-extrabold text-stone-900">
                      {formatPrice(item.pricePaise, currency)}
                    </span>
                  </div>

                  {item.description && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.isFeatured && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                        Featured
                      </span>
                    )}
                    {(item.spiceLevel ?? 0) > 0 && (
                      <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                        <Flame className="mr-0.5 inline h-2.5 w-2.5" />
                        Lvl {item.spiceLevel}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-50 hover:text-red-600"
                    title="Remove Item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal: Add Category */}
      {showAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">Add Menu Category</h2>
              <button
                onClick={() => setShowAddCategory(false)}
                className="rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Traditional Curries, Beverages"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Short tagline for this section"
                  value={categoryDescription}
                  onChange={(e) => setCategoryDescription(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategory(false)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !categoryName.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Category</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Menu Item */}
      {showAddItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-xs">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900">Add Menu Item</h2>
              <button
                onClick={() => setShowAddItem(false)}
                className="rounded-lg p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Category *
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Dish Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Butter Chicken, Paneer Tikka"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Price in {currency} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="299"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
                <span className="mt-0.5 block text-[10px] text-stone-400">
                  Stored safely in database as integer minor units (paise).
                </span>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-700">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation details, serving size..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              {/* Dietary and Options */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Dietary Classification
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(true)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                        itemIsVeg
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-stone-200 text-stone-500"
                      }`}
                    >
                      <Leaf className="h-3 w-3" />
                      Veg
                    </button>
                    <button
                      type="button"
                      onClick={() => setItemIsVeg(false)}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold ${
                        !itemIsVeg
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-stone-200 text-stone-500"
                      }`}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-700">
                    Spice Level (0-3)
                  </label>
                  <select
                    value={itemSpiceLevel}
                    onChange={(e) => setItemSpiceLevel(parseInt(e.target.value, 10))}
                    className="w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value={0}>0 — Mild / None</option>
                    <option value={1}>1 — Medium 🌶️</option>
                    <option value={2}>2 — Spicy 🌶️🌶️</option>
                    <option value={3}>3 — Hot 🌶️🌶️🌶️</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="featured"
                  checked={itemIsFeatured}
                  onChange={(e) => setItemIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="featured" className="text-xs font-medium text-stone-700">
                  Feature this dish prominently on public menu
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !itemName.trim() || !itemPrice}
                  className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Dish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
