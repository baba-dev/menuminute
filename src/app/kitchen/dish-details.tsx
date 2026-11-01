import { AlertTriangle, MessageSquareText, Leaf } from "lucide-react";
import type { DishSafetySnapshot } from "@/modules/kitchen/service";
import { describeDishSafety } from "@/modules/kitchen/presentation";

type Props = {
  variantName: string | null;
  selectedOptions: ReadonlyArray<{ groupName: string; optionName: string }>;
  /** Guest/POS note written for this dish. */
  notes: string | null;
  dishSafety?: DishSafetySnapshot | null;
  /** Compact rows (Final Check) drop the roomier spacing. */
  compact?: boolean;
};

/**
 * What the cook must read for one dish: allergens, customisations, then the guest's
 * own words. Every cue pairs an icon and a label, so colour is never the only signal.
 * Allergen data is the restaurant's own declaration, labelled as such.
 */
export function DishDetails({ variantName, selectedOptions, notes, dishSafety, compact }: Props) {
  const safety = describeDishSafety(dishSafety);
  const customised = Boolean(variantName) || selectedOptions.length > 0;
  return (
    <div className={"kk-dish" + (compact ? " kk-dish-compact" : "")}>
      {(safety.allergens.length > 0 || safety.crossContact) && (
        <div className="kk-allergen" role="group" aria-label="Allergen information">
          <span className="kk-allergen-title">
            <AlertTriangle size={14} aria-hidden="true" /> Contains
          </span>
          {safety.allergens.map((label) => (
            <span className="kk-allergen-chip" key={label}>
              {label}
            </span>
          ))}
          {safety.crossContact && (
            <small className="kk-allergen-cross">Cross-contact: {safety.crossContact}</small>
          )}
          <small className="kk-allergen-source">
            As listed by the restaurant{safety.unverified ? " · not verified" : ""}
          </small>
        </div>
      )}
      {customised && (
        <ul className="kk-mods" aria-label="Customisations">
          {variantName && (
            <li className="kk-mod kk-mod-size">
              <span>Size</span>
              <strong>{variantName}</strong>
            </li>
          )}
          {selectedOptions.map((o, i) => (
            <li className="kk-mod" key={i}>
              <span>{o.groupName}</span>
              <strong>{o.optionName}</strong>
            </li>
          ))}
        </ul>
      )}
      {notes?.trim() && (
        <p className="kk-guest-note">
          <MessageSquareText size={16} aria-hidden="true" />
          <span>
            <small>Guest note</small>
            {notes}
          </span>
        </p>
      )}
      {safety.dietary.length > 0 && (
        <p className="kk-dietary">
          <Leaf size={13} aria-hidden="true" /> {safety.dietary.join(" · ")}
        </p>
      )}
    </div>
  );
}
