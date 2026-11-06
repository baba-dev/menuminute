"use client";

import { CookingPot, Flame, Snowflake, Sparkles, Thermometer } from "lucide-react";
import { getSpicePresentation, MAX_SPICE_LEVEL } from "@/modules/menu-product/spice-presentation";
import type { CustomizerDish } from "./item-customizer";

/** Decorative chilli illustration. Text labels always carry the heat meaning. */
function Chilli({ active }: { active: boolean }) {
  return (
    <svg
      className={`dining-chilli ${active ? "is-active" : ""}`}
      width="24"
      height="24"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12.1 8.9C7.6 7.6 4.3 11 5.5 15.8c1.7 6.7 9.1 11 21 9-7.5-1.9-10.2-6.2-10-10.9.1-2.8-1.8-4.4-4.4-5Z"
        fill="currentColor"
      />
      <path
        d="M13.2 9.5c.2-4.1 2.7-6.1 6.5-5.7"
        stroke="#66883d"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

const SERVING = {
  hot: { label: "Hot", Icon: Flame },
  chilled: { label: "Chilled", Icon: Snowflake },
  ambient: { label: "Room temperature", Icon: Thermometer },
} as const;

/** Read-only culinary facts; these are merchant-entered, not inferred cooking promises. */
export function DishTasteProfile({ culinary }: { culinary?: CustomizerDish["culinary"] }) {
  const spice = getSpicePresentation(culinary?.spiceLevel);
  const serving = culinary?.servingTemp ? SERVING[culinary.servingTemp] : null;
  const flavors = culinary?.flavorNotes ?? [];
  if (!spice && !serving && flavors.length === 0) return null;
  const ServingIcon = serving?.Icon;

  return (
    <section className="dining-taste-panel" aria-label="Taste and serving details">
      <div className="dining-taste-heading">
        <CookingPot size={18} aria-hidden="true" />
        <span>Taste &amp; serving</span>
      </div>
      {(spice || serving) && (
        <div className="dining-taste-facts">
          {spice && (
            <div className="dining-taste-fact">
              <div className="dining-taste-fact-title">
                <span>Spice level</span>
                <strong>{spice.label}</strong>
              </div>
              <div
                className="dining-chilli-meter"
                role="img"
                aria-label={`Heat: ${spice.level} of ${MAX_SPICE_LEVEL} chillies (${spice.label})`}
              >
                {Array.from({ length: MAX_SPICE_LEVEL }, (_, index) => (
                  <Chilli key={index} active={index < spice.level} />
                ))}
              </div>
            </div>
          )}
          {serving && ServingIcon && (
            <div className="dining-taste-fact dining-serving-fact">
              <span className="dining-serving-icon">
                <ServingIcon size={19} aria-hidden="true" />
              </span>
              <div className="dining-serving-copy">
                <span>Best served</span>
                <strong>{serving.label}</strong>
              </div>
            </div>
          )}
        </div>
      )}
      {flavors.length > 0 && (
        <div className="dining-taste-flavors">
          <span>
            <Sparkles size={14} aria-hidden="true" /> Flavor notes
          </span>
          <div className="dining-flavor-list">
            {flavors.map((note) => (
              <span className="dining-flavor-tag" key={note}>
                {note}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
