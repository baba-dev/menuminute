import manifest from "../../../docs/food-artwork/manifest.json";
import { normalizeDishText } from "./dish-intelligence";

/** Bundled and integrity-checked deployment assets; never accept an arbitrary image URL. */
export type ArtworkAsset = {
  label: string;
  path: string;
  state: string;
  slug: string;
  category: string;
  datasetId?: string;
};
const canonical = /^\/assets\/food\/dishes\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;
const allowedStates = new Set([
  "approved",
  "assets-imported",
  "assets-imported-awaiting-owner-review",
]);
export const artworkAssets = (manifest.assets as ArtworkAsset[])
  .filter((a) => allowedStates.has(a.state) && canonical.test(a.path))
  .map((a) => ({ ...a, id: a.category + "__" + a.slug }));
export type DishArtwork = (typeof artworkAssets)[number];

export function artworkById(id: string | null | undefined): DishArtwork | null {
  return id ? (artworkAssets.find((a) => a.id === id) ?? null) : null;
}
export function artworkForDish(name: string, catalogueId?: string | null): DishArtwork | null {
  const wanted = normalizeDishText(name);
  if (!wanted) return null;
  if (catalogueId) {
    const found = artworkAssets.find((a) => a.datasetId === catalogueId);
    if (found) return found;
  }
  // Exact normalized labels only; ambiguous labels do not silently pick an unrelated illustration.
  const matches = artworkAssets.filter((a) => normalizeDishText(a.label) === wanted);
  return matches.length === 1 ? matches[0]! : null;
}
/** Compatibility alias for existing Composer call sites. */
export function approvedArtworkForDish(
  name: string,
  assets: readonly ArtworkAsset[] = manifest.assets
): { path: string; label: string } | null {
  const wanted = normalizeDishText(name);
  if (!wanted) return null;
  const exact = assets.find(
    (asset) =>
      asset.state === "approved" &&
      canonical.test(asset.path) &&
      normalizeDishText(asset.label) === wanted
  );
  return exact ? { path: exact.path, label: exact.label } : null;
}

export function dishImageSrc(
  dish: {
    name: string;
    mediaId?: string | null;
    artworkId?: string | null;
    imageMode?: "auto" | "artwork" | "photo" | "none";
  },
  visibility: "public" | "private" = "public"
): string {
  if (dish.imageMode === "none") return "/icons/category-default.svg";
  const photo = dish.mediaId
    ? (visibility === "public" ? "/api/public-media/" : "/api/media/") +
      encodeURIComponent(dish.mediaId) +
      (visibility === "public" ? "?size=thumb" : "")
    : null;
  if (dish.imageMode === "photo") return photo ?? "/icons/category-default.svg";
  const art =
    artworkById(dish.artworkId) ??
    (dish.imageMode === "auto" || !dish.imageMode ? artworkForDish(dish.name) : null);
  if (dish.imageMode === "artwork") return art?.path ?? "/icons/category-default.svg";
  return photo ?? art?.path ?? "/icons/category-default.svg";
}
