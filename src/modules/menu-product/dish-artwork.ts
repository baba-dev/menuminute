import manifest from "../../../docs/food-artwork/manifest.json";
import { normalizeDishText } from "./dish-intelligence";

export type ArtworkAsset = {
  label: string;
  path: string;
  state: string;
  slug: string;
  category: string;
};
const canonical = /^\/assets\/food\/dishes\/[a-z0-9-]+\/[a-z0-9-]+\.png$/;

/** The manifest currently says "awaiting owner review": imported != approved.
 * Recommendations are visual guidance only; they do not become dish_media identities.
 */
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
