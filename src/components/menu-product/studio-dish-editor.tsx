"use client";
import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Sparkles,
  Flame,
  ShieldAlert,
  HeartPulse,
  Utensils,
  Check,
} from "lucide-react";
import type { MenuDocument, Allergen } from "@/modules/menu-product/contracts";
import { Field, Money } from "./studio-fields";
import { ScheduleEditor } from "./schedule-editor";
import { artworkForDish, artworkById, dishImageSrc } from "@/modules/menu-product/dish-artwork";
import { findCulinaryProfile, normalizeDishText } from "@/modules/menu-product/dish-intelligence";

type Dish = MenuDocument["categories"][number]["items"][number];
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
const id = () => crypto.randomUUID();

const ALLERGEN_OPTIONS: { id: Allergen; label: string }[] = [
  { id: "dairy", label: "Dairy" },
  { id: "gluten", label: "Gluten / Wheat" },
  { id: "nuts", label: "Tree Nuts" },
  { id: "peanuts", label: "Peanuts" },
  { id: "eggs", label: "Eggs" },
  { id: "soy", label: "Soy" },
  { id: "fish", label: "Fish" },
  { id: "shellfish", label: "Shellfish" },
  { id: "sesame", label: "Sesame" },
  { id: "mustard", label: "Mustard" },
  { id: "sulfites", label: "Sulfites" },
];

const FLAVOR_TAG_PRESETS = [
  "Rich & Creamy",
  "Smoky",
  "Tangy",
  "Mildly Sweet",
  "Crispy",
  "Zesty",
  "Aromatic",
  "Hearty",
  "Savory",
  "Cooling",
];

/** Advanced dish controls retain the canonical schema and pricing precision. */
export function StudioDishEditor({
  dish,
  ci,
  di,
  dishCount,
  currency,
  media,
  canWrite,
  companionDishes = [],
  onUpdate,
  onMove,
}: {
  dish: Dish;
  ci: number;
  di: number;
  dishCount: number;
  canWrite: boolean;
  currency: string;
  media: Media[];
  companionDishes?: { id: string; name: string }[];
  onUpdate: (patch: Partial<Dish>) => void;
  onMove: (delta: number) => void;
}) {
  const [customFlavorInput, setCustomFlavorInput] = useState("");
  const [pairingSearch, setPairingSearch] = useState("");
  const suggestedProfile = findCulinaryProfile(dish.name);

  const culinary = dish.culinary ?? {
    spiceLevel: 0,
    flavorNotes: [],
    chefNote: "",
    servingTemp: "hot" as const,
    pairingDishIds: [],
  };

  const nutrition: NonNullable<Dish["nutrition"]> = dish.nutrition ?? {};
  const safety: NonNullable<Dish["safety"]> = dish.safety ?? { ingredients: [], allergens: [] };
  const pairingOptions = companionDishes
    .filter((candidate) => candidate.id !== dish.id)
    .filter(
      (candidate) =>
        !pairingSearch.trim() ||
        normalizeDishText(candidate.name).includes(normalizeDishText(pairingSearch)) ||
        culinary.pairingDishIds.includes(candidate.id)
    )
    .slice(0, 12);
  const canVerifyFreeFrom =
    safety.verified === true &&
    safety.ingredients.length > 0 &&
    !safety.crossContact?.trim() &&
    dish.variants.length === 0 &&
    dish.addOnGroups.length === 0;

  const updateCulinary = (patch: Partial<typeof culinary>) => {
    onUpdate({
      culinary: {
        spiceLevel: culinary.spiceLevel,
        flavorNotes: culinary.flavorNotes,
        chefNote: culinary.chefNote,
        servingTemp: culinary.servingTemp,
        pairingDishIds: culinary.pairingDishIds,
        ...patch,
      },
    });
  };

  const updateNutrition = (patch: Partial<typeof nutrition>) => {
    onUpdate({ nutrition: { ...nutrition, ...patch, verified: false } });
  };

  const updateSafety = (patch: Partial<typeof safety>) => {
    // Any ingredient/allergen/cross-contact edit invalidates previous confirmations.
    onUpdate({ safety: { ...safety, ...patch, verified: false, verifiedFreeFrom: [] } });
  };
  return (
    <div className="atelier-dish-row dish-editor stack">
      {/* Private authenticated media must use its existing scoped API route. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="atelier-dish-artwork"
        src={dishImageSrc(dish, "private")}
        alt={
          dish.imageMode === "none"
            ? ""
            : dish.imageMode === "photo" || (dish.imageMode === "auto" && dish.mediaId)
              ? "Uploaded photograph for " + dish.name
              : "Selected image for " + dish.name
        }
        width={104}
        height={84}
        loading="lazy"
      />
      <div className="row between">
        <span className="eyebrow">Dish {di + 1}</span>
        <div className="row" aria-label={`Reorder ${dish.name || "untitled dish"}`}>
          <button
            type="button"
            aria-label={`Move dish ${di + 1} up`}
            disabled={di === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move dish ${di + 1} down`}
            disabled={di === dishCount - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="columns">
        <Field
          label={`Dish name ${ci + 1}.${di + 1}`}
          value={dish.name}
          onChange={(name) => onUpdate({ name })}
        />
        <Money
          label={`Dish price ${ci + 1}.${di + 1}`}
          value={dish.priceMinor}
          currency={currency}
          onChange={(priceMinor) => onUpdate({ priceMinor })}
        />
      </div>
      <label className="field">
        Description
        <textarea
          value={dish.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          maxLength={1000}
        />
      </label>
      <div className="row">
        <label>
          <input
            type="checkbox"
            checked={dish.soldOut}
            onChange={(e) => onUpdate({ soldOut: e.target.checked })}
          />
          Sold out
        </label>
        <label>
          <input
            type="checkbox"
            checked={dish.archived}
            onChange={(e) => onUpdate({ archived: e.target.checked })}
          />
          Archived dish
        </label>
        {(["vegetarian", "vegan", "gluten_free"] as const).map((d) => (
          <label key={d}>
            <input
              type="checkbox"
              checked={dish.dietary.includes(d)}
              onChange={(e) =>
                onUpdate({
                  dietary: e.target.checked
                    ? [...dish.dietary, d]
                    : dish.dietary.filter((x) => x !== d),
                })
              }
            />
            {d.replaceAll("_", " ")}
          </label>
        ))}
      </div>
      <label className="field">
        Dish image
        <select
          aria-label={`Dish photo ${ci + 1}.${di + 1}`}
          value={
            dish.imageMode === "auto"
              ? "auto"
              : dish.imageMode === "photo"
                ? "photo:" + (dish.mediaId ?? "")
                : dish.imageMode
          }
          onChange={(e) => {
            const value = e.target.value;
            const art = artworkById(dish.artworkId) ?? artworkForDish(dish.name);
            onUpdate(
              value.startsWith("photo:")
                ? { imageMode: "photo", mediaId: value.slice(6) }
                : value === "artwork" && art
                  ? { imageMode: "artwork", artworkId: art.id, mediaId: null }
                  : { imageMode: value as Dish["imageMode"], mediaId: null }
            );
          }}
        >
          {dish.imageMode === "auto" && <option value="auto">Automatic · legacy selection</option>}
          {(artworkById(dish.artworkId) ?? artworkForDish(dish.name)) && (
            <option value="artwork">Curated illustration</option>
          )}
          <option value="none">No image</option>
          {dish.mediaId && !media.some((a) => a.id === dish.mediaId) && (
            <option value={"photo:" + dish.mediaId}>Current approved photo</option>
          )}
          {media
            .filter((a) => a.status === "ready" && a.approvedAt)
            .map((a, n) => (
              <option key={a.id} value={"photo:" + a.id}>
                Approved photo {n + 1}
              </option>
            ))}
        </select>
      </label>

      {suggestedProfile && (
        <div className="atelier-culinary-suggest-banner row between wrap">
          <div className="row" style={{ gap: "0.5rem" }}>
            <Sparkles size={16} className="ember-text" />
            <span style={{ fontSize: "0.9rem" }}>
              Authentic profile available for <strong>{suggestedProfile.name}</strong> (
              {suggestedProfile.category}) — unverified reference values; review your actual recipe
              before publishing.
            </span>
          </div>
          <button
            type="button"
            className="atelier-btn-suggest"
            disabled={!canWrite}
            onClick={() => {
              onUpdate({
                nutrition: { ...suggestedProfile.nutrition, verified: false },
                culinary: {
                  spiceLevel: suggestedProfile.culinary.spiceLevel,
                  flavorNotes: suggestedProfile.culinary.flavorNotes,
                  chefNote: suggestedProfile.culinary.chefNote,
                  servingTemp: suggestedProfile.culinary.servingTemp,
                  pairingDishIds: suggestedProfile.culinary.suggestedPairings
                    .map(
                      (name) =>
                        companionDishes.find(
                          (item) =>
                            normalizeDishText(item.name) === normalizeDishText(name) &&
                            item.id !== dish.id
                        )?.id
                    )
                    .filter((value): value is string => Boolean(value))
                    .slice(0, 4),
                },
                safety: { ...suggestedProfile.safety, verified: false, verifiedFreeFrom: [] },
              });
            }}
          >
            Use editable recipe suggestion
          </button>
        </div>
      )}

      <details className="atelier-culinary-details">
        <summary>
          <Flame
            size={16}
            style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }}
          />
          Taste & Heat Profile
        </summary>
        <div className="stack" style={{ gap: "1rem", paddingTop: "0.5rem" }}>
          <div className="field">
            <span className="label">Spice Level (Heat)</span>
            <div className="row wrap" style={{ gap: "0.5rem", marginTop: "0.3rem" }}>
              {[
                { level: 0, label: "0 · No Heat" },
                { level: 1, label: "1 · Mild 🔥" },
                { level: 2, label: "2 · Medium 🔥🔥" },
                { level: 3, label: "3 · Hot 🔥🔥🔥" },
                { level: 4, label: "4 · Extra Fiery 🔥🔥🔥🔥" },
              ].map(({ level, label }) => (
                <button
                  key={level}
                  type="button"
                  className={`atelier-pill-btn ${culinary.spiceLevel === level ? "active" : ""}`}
                  aria-pressed={culinary.spiceLevel === level}
                  disabled={!canWrite}
                  onClick={() => updateCulinary({ spiceLevel: level })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span className="label">Flavor Notes</span>
            <div className="row wrap" style={{ gap: "0.4rem", marginTop: "0.3rem" }}>
              {FLAVOR_TAG_PRESETS.map((tag) => {
                const isSelected = culinary.flavorNotes.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`atelier-pill-btn ${isSelected ? "active" : ""}`}
                    aria-pressed={isSelected}
                    disabled={!canWrite}
                    onClick={() => {
                      updateCulinary({
                        flavorNotes: isSelected
                          ? culinary.flavorNotes.filter((t) => t !== tag)
                          : [...culinary.flavorNotes, tag].slice(0, 6),
                      });
                    }}
                  >
                    {isSelected && (
                      <Check size={12} style={{ display: "inline", marginRight: "0.2rem" }} />
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="row" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                disabled={!canWrite}
                type="text"
                placeholder="Add custom flavor note..."
                value={customFlavorInput}
                onChange={(e) => setCustomFlavorInput(e.target.value)}
                maxLength={30}
                style={{ maxWidth: "240px" }}
              />
              <button
                type="button"
                disabled={
                  !canWrite || !customFlavorInput.trim() || culinary.flavorNotes.length >= 6
                }
                onClick={() => {
                  if (!customFlavorInput.trim()) return;
                  if (!culinary.flavorNotes.includes(customFlavorInput.trim())) {
                    updateCulinary({
                      flavorNotes: [...culinary.flavorNotes, customFlavorInput.trim()].slice(0, 6),
                    });
                  }
                  setCustomFlavorInput("");
                }}
              >
                Add Tag
              </button>
            </div>
          </div>

          <label className="field">
            Chef&apos;s Tasting Note / Heritage Story
            <textarea
              disabled={!canWrite}
              value={culinary.chefNote ?? ""}
              onChange={(e) => updateCulinary({ chefNote: e.target.value })}
              placeholder="e.g. 16-hour slow simmered over charcoal with hand-churned white butter..."
              maxLength={300}
              rows={2}
            />
          </label>

          <label className="field">
            Serving Temperature
            <select
              disabled={!canWrite}
              value={culinary.servingTemp ?? "hot"}
              onChange={(e) =>
                updateCulinary({ servingTemp: e.target.value as "hot" | "chilled" | "ambient" })
              }
              style={{ maxWidth: "200px" }}
            >
              <option value="hot">Served Hot</option>
              <option value="chilled">Served Chilled / Cold</option>
              <option value="ambient">Room Temperature</option>
            </select>
          </label>
        </div>
      </details>

      <details className="atelier-culinary-details">
        <summary>
          <HeartPulse
            size={16}
            style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }}
          />
          Nutritional Values & Serving
        </summary>
        <div className="stack" style={{ gap: "1rem", paddingTop: "0.5rem" }}>
          <div
            className="columns"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <label className="field">
              Calories (kcal)
              <input
                disabled={!canWrite}
                type="number"
                min={0}
                max={10000}
                placeholder="e.g. 480"
                value={nutrition.calories ?? ""}
                onChange={(e) =>
                  updateNutrition({
                    calories:
                      e.target.value === "" ? undefined : Math.max(0, parseInt(e.target.value, 10)),
                  })
                }
              />
            </label>
            <label className="field">
              Protein (g)
              <input
                disabled={!canWrite}
                type="number"
                min={0}
                max={1000}
                step={0.5}
                placeholder="e.g. 24"
                value={nutrition.proteinGrams ?? ""}
                onChange={(e) =>
                  updateNutrition({
                    proteinGrams:
                      e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value)),
                  })
                }
              />
            </label>
            <label className="field">
              Carbs (g)
              <input
                disabled={!canWrite}
                type="number"
                min={0}
                max={1000}
                step={0.5}
                placeholder="e.g. 38"
                value={nutrition.carbsGrams ?? ""}
                onChange={(e) =>
                  updateNutrition({
                    carbsGrams:
                      e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value)),
                  })
                }
              />
            </label>
            <label className="field">
              Total Fat (g)
              <input
                disabled={!canWrite}
                type="number"
                min={0}
                max={1000}
                step={0.5}
                placeholder="e.g. 18"
                value={nutrition.fatGrams ?? ""}
                onChange={(e) =>
                  updateNutrition({
                    fatGrams:
                      e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value)),
                  })
                }
              />
            </label>
            <label className="field">
              Dietary Fiber (g)
              <input
                disabled={!canWrite}
                type="number"
                min={0}
                max={500}
                step={0.5}
                placeholder="e.g. 6"
                value={nutrition.fiberGrams ?? ""}
                onChange={(e) =>
                  updateNutrition({
                    fiberGrams:
                      e.target.value === "" ? undefined : Math.max(0, parseFloat(e.target.value)),
                  })
                }
              />
            </label>
          </div>
          <label className="field">
            Serving Size Description
            <input
              disabled={!canWrite}
              type="text"
              placeholder="e.g. Serves 1-2 · approx. 350g"
              value={nutrition.servingSize ?? ""}
              onChange={(e) => updateNutrition({ servingSize: e.target.value || undefined })}
              maxLength={60}
            />
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={nutrition.verified === true}
                onChange={(event) =>
                  onUpdate({ nutrition: { ...nutrition, verified: event.target.checked } })
                }
              />{" "}
              I checked these nutrition numbers against this restaurant&apos;s actual portion and recipe
            </span>
            <small className="quiet">Unverified estimates never appear in the guest menu.</small>
          </label>
        </div>
      </details>

      <details className="atelier-culinary-details">
        <summary>
          <ShieldAlert
            size={16}
            style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }}
          />
          Ingredients & Allergen Safety
        </summary>
        <div className="stack" style={{ gap: "1rem", paddingTop: "0.5rem" }}>
          <label className="field">
            Key Ingredients (comma-separated)
            <textarea
              disabled={!canWrite}
              placeholder="e.g. Cottage cheese, Roma tomatoes, Butter, Cashew nut paste, Ginger, Fenugreek"
              value={safety.ingredients.join(", ")}
              onChange={(e) =>
                updateSafety({
                  ingredients: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 30),
                })
              }
              rows={2}
            />
          </label>

          <div className="field">
            <span className="label">Allergen Declarations (select all that apply)</span>
            <div className="row wrap" style={{ gap: "0.4rem", marginTop: "0.3rem" }}>
              {ALLERGEN_OPTIONS.map(({ id: aId, label }) => {
                const contains = safety.allergens.includes(aId);
                return (
                  <button
                    key={aId}
                    type="button"
                    className={`atelier-pill-btn ${contains ? "active allergen-active" : ""}`}
                    aria-pressed={contains}
                    disabled={!canWrite}
                    onClick={() => {
                      updateSafety({
                        allergens: contains
                          ? safety.allergens.filter((x) => x !== aId)
                          : [...safety.allergens, aId],
                      });
                    }}
                  >
                    {contains && (
                      <Check size={12} style={{ display: "inline", marginRight: "0.2rem" }} />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="field">
            Kitchen Cross-Contact Disclaimer
            <input
              disabled={!canWrite}
              type="text"
              placeholder="e.g. Cooked in a kitchen that also processes wheat and peanuts."
              value={safety.crossContact ?? ""}
              onChange={(e) => updateSafety({ crossContact: e.target.value || undefined })}
              maxLength={250}
            />
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                disabled={!canWrite}
                checked={safety.verified === true}
                onChange={(event) =>
                  onUpdate({
                    safety: { ...safety, verified: event.target.checked, verifiedFreeFrom: [] },
                  })
                }
              />{" "}
              I verified the ingredients, allergen declaration and kitchen cross-contact for this
              exact dish
            </span>
            <small className="quiet">A recipe suggestion is not a safety verification.</small>
          </label>
          <fieldset className="field" disabled={!canWrite || !canVerifyFreeFrom}>
            <legend>Optional verified free-from declarations</legend>
            <p className="quiet">
              Only confirm after checking every ingredient and shared surface. Dishes with variants
              or add-ons require option-level safety data and cannot claim free-from.
            </p>
            {(["nuts", "dairy"] as const).map((claim) => {
              const declared =
                safety.allergens.includes(claim) ||
                (claim === "nuts" && safety.allergens.includes("peanuts"));
              const checked = safety.verifiedFreeFrom?.includes(claim) ?? false;
              return (
                <label key={claim} className="row" style={{ gap: "0.4rem" }}>
                  <input
                    type="checkbox"
                    disabled={declared}
                    checked={checked}
                    onChange={(event) =>
                      onUpdate({
                        safety: {
                          ...safety,
                          verifiedFreeFrom: event.target.checked
                            ? [...(safety.verifiedFreeFrom ?? []), claim]
                            : (safety.verifiedFreeFrom ?? []).filter((value) => value !== claim),
                        },
                      })
                    }
                  />
                  Confirmed {claim === "nuts" ? "nut-free" : "dairy-free"}
                </label>
              );
            })}
          </fieldset>
        </div>
      </details>

      {companionDishes.length > 0 && (
        <details className="atelier-culinary-details">
          <summary>
            <Utensils
              size={16}
              style={{ display: "inline", verticalAlign: "middle", marginRight: "0.4rem" }}
            />
            Chef Recommended Pairings ({culinary.pairingDishIds.length}/4 selected)
          </summary>
          <div className="stack" style={{ gap: "0.5rem", paddingTop: "0.5rem" }}>
            <span className="quiet" style={{ fontSize: "0.85rem" }}>
              Recommend companion dishes (e.g. bread, rice, beverage, or dessert) for diners to
              order together.
            </span>
            <input
              type="search"
              aria-label="Search companion dishes"
              disabled={!canWrite}
              placeholder="Find a dish to recommend…"
              value={pairingSearch}
              onChange={(event) => setPairingSearch(event.target.value)}
            />
            <div className="row wrap" style={{ gap: "0.4rem" }}>
              {pairingOptions.map((companion) => {
                const isSelected = culinary.pairingDishIds.includes(companion.id);
                return (
                  <button
                    key={companion.id}
                    type="button"
                    className={`atelier-pill-btn ${isSelected ? "active" : ""}`}
                    aria-pressed={isSelected}
                    disabled={!canWrite}
                    onClick={() => {
                      updateCulinary({
                        pairingDishIds: isSelected
                          ? culinary.pairingDishIds.filter((pId) => pId !== companion.id)
                          : [...culinary.pairingDishIds, companion.id].slice(0, 4),
                      });
                    }}
                  >
                    {isSelected && (
                      <Check size={12} style={{ display: "inline", marginRight: "0.2rem" }} />
                    )}
                    {companion.name}
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      )}

      <details>
        <summary>Variants & add-ons</summary>
        <div className="stack">
          {dish.variants.map((v, vi) => (
            <div className="columns" key={v.id}>
              <Field
                label={`Variant name ${vi + 1}`}
                value={v.name}
                onChange={(name) =>
                  onUpdate({
                    variants: dish.variants.map((x, n) => (n === vi ? { ...x, name } : x)),
                  })
                }
              />
              <Money
                label={`Variant price ${vi + 1}`}
                value={v.priceMinor}
                currency={currency}
                onChange={(priceMinor) =>
                  onUpdate({
                    variants: dish.variants.map((x, n) => (n === vi ? { ...x, priceMinor } : x)),
                  })
                }
              />
              <label>
                <input
                  type="checkbox"
                  checked={v.isAvailable}
                  onChange={(e) =>
                    onUpdate({
                      variants: dish.variants.map((x, n) =>
                        n === vi ? { ...x, isAvailable: e.target.checked } : x
                      ),
                    })
                  }
                />
                Available
              </label>
              <button
                type="button"
                onClick={() =>
                  onUpdate({
                    variants: dish.variants.filter((_, n) => n !== vi),
                  })
                }
              >
                Remove variant
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onUpdate({
                variants: [
                  ...dish.variants,
                  {
                    id: id(),
                    name: "New variant",
                    priceMinor: dish.priceMinor,
                    isAvailable: true,
                  },
                ],
              })
            }
          >
            Add variant
          </button>
          {dish.addOnGroups.map((g, gi) => {
            const updateGroup = (patch: Partial<typeof g>) =>
              onUpdate({
                addOnGroups: dish.addOnGroups.map((x, n) => (n === gi ? { ...x, ...patch } : x)),
              });
            return (
              <div key={g.id} className="panel stack">
                <Field
                  label={`Add-on group ${gi + 1}`}
                  value={g.name}
                  onChange={(name) => updateGroup({ name })}
                />
                <div className="columns">
                  <label className="field">
                    Minimum selections
                    <input
                      type="number"
                      min={0}
                      value={g.min}
                      onChange={(e) => updateGroup({ min: Number(e.target.value) })}
                    />
                  </label>
                  <label className="field">
                    Maximum selections
                    <input
                      type="number"
                      min={1}
                      value={g.max}
                      onChange={(e) => updateGroup({ max: Number(e.target.value) })}
                    />
                  </label>
                </div>
                {g.options.map((o, oi) => (
                  <div className="columns" key={o.id}>
                    <Field
                      label={`Add-on name ${oi + 1}`}
                      value={o.name}
                      onChange={(name) =>
                        updateGroup({
                          options: g.options.map((x, n) => (n === oi ? { ...x, name } : x)),
                        })
                      }
                    />
                    <Money
                      label={`Add-on price ${oi + 1}`}
                      value={o.priceMinor}
                      currency={currency}
                      onChange={(priceMinor) =>
                        updateGroup({
                          options: g.options.map((x, n) => (n === oi ? { ...x, priceMinor } : x)),
                        })
                      }
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={o.isAvailable}
                        onChange={(e) =>
                          updateGroup({
                            options: g.options.map((item, n) =>
                              n === oi
                                ? {
                                    ...item,
                                    isAvailable: e.target.checked,
                                  }
                                : item
                            ),
                          })
                        }
                      />
                      Available
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateGroup({
                          options: g.options.filter((_, n) => n !== oi),
                        })
                      }
                    >
                      Remove add-on
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateGroup({
                      options: [
                        ...g.options,
                        {
                          id: id(),
                          name: "New option",
                          priceMinor: 0,
                          isAvailable: true,
                        },
                      ],
                    })
                  }
                >
                  Add option
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({
                      addOnGroups: dish.addOnGroups.filter((_, n) => n !== gi),
                    })
                  }
                >
                  Remove add-on group
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              onUpdate({
                addOnGroups: [
                  ...dish.addOnGroups,
                  {
                    id: id(),
                    name: "Extras",
                    min: 0,
                    max: 1,
                    options: [
                      {
                        id: id(),
                        name: "New option",
                        priceMinor: 0,
                        isAvailable: true,
                      },
                    ],
                  },
                ],
              })
            }
          >
            Add add-on group
          </button>
        </div>
      </details>
      <details>
        <summary>Dish schedule</summary>
        <ScheduleEditor value={dish.schedule} onChange={(schedule) => onUpdate({ schedule })} />
      </details>
    </div>
  );
}
