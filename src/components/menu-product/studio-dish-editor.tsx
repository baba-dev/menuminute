"use client";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { Field, Money } from "./studio-fields";
import { ScheduleEditor } from "./schedule-editor";
import { artworkForDish, artworkById, dishImageSrc } from "@/modules/menu-product/dish-artwork";

type Dish = MenuDocument["categories"][number]["items"][number];
type Media = { id: string; status: string; approvedAt: string | null; lastError: string | null };
const id = () => crypto.randomUUID();
/** Advanced dish controls retain the canonical schema and pricing precision. */
export function StudioDishEditor({
  dish,
  ci,
  di,
  dishCount,
  currency,
  media,
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
  onUpdate: (patch: Partial<Dish>) => void;
  onMove: (delta: number) => void;
}) {
  return (
    <div className="atelier-dish-row dish-editor stack">
      <img
        className="atelier-dish-artwork"
        src={dishImageSrc(dish, "private")}
        alt={dish.imageMode === "none" ? "" : "Selected image for " + dish.name}
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
