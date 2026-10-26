"use client";

import { Utensils, Coffee, ShoppingBag, Flame, Hotel, Sparkles, Check } from "lucide-react";
import type { WizardDraft } from "../wizard-types";

interface StepIdentityProps {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}

const OUTLET_TYPES = [
  {
    id: "restaurant" as const,
    name: "Restaurant / Diner",
    desc: "Full-service dining with seated guest experience and table service.",
    icon: Utensils,
    defaultFulfillment: ["dine_in" as const],
  },
  {
    id: "cafe" as const,
    name: "Cafe & Bakery",
    desc: "Artisan coffee, counter service, pastries, and casual seating.",
    icon: Coffee,
    defaultFulfillment: ["pickup" as const],
  },
  {
    id: "takeout" as const,
    name: "Takeout & Quick",
    desc: "Fast service, counter pickup, street food, and takeaway orders.",
    icon: ShoppingBag,
    defaultFulfillment: ["pickup" as const],
  },
  {
    id: "cloud_kitchen" as const,
    name: "Cloud / Ghost Kitchen",
    desc: "Delivery & pickup focused commercial kitchen with no dining room.",
    icon: Flame,
    defaultFulfillment: ["pickup" as const],
  },
  {
    id: "hotel" as const,
    name: "Hotel Dining & Lounge",
    desc: "In-room service, lobby lounges, and multi-venue hospitality.",
    icon: Hotel,
    defaultFulfillment: ["dine_in" as const],
  },
  {
    id: "mixed" as const,
    name: "Mixed Hospitality",
    desc: "Hybrid venue offering both dine-in experience and takeaway pickup.",
    icon: Sparkles,
    defaultFulfillment: ["dine_in" as const, "pickup" as const],
  },
];

const PRESET_PALETTES = [
  { name: "Warm Amber", primary: "#f97316", secondary: "#1c1917" },
  { name: "Emerald Hearth", primary: "#10b981", secondary: "#064e3b" },
  { name: "Indigo Night", primary: "#6366f1", secondary: "#1e1b4b" },
  { name: "Crimson Rose", primary: "#f43f5e", secondary: "#4c0519" },
  { name: "Velvet Obsidian", primary: "#eab308", secondary: "#18181b" },
];

export function StepIdentity({ draft, onChange }: StepIdentityProps) {
  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 01 / Identity</span>
        <h2 className="wizard-title">Tell us about your outlet.</h2>
        <p className="wizard-desc">
          Give your outlet a public name, select the operational style, and pick your signature
          brand colors.
        </p>
      </div>

      {/* Outlet Name */}
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-name">
          <span>Outlet Public Name *</span>
          <span className="wizard-counter">{draft.name.length} / 100</span>
        </label>
        <input
          id="wz-name"
          className="wizard-input"
          placeholder="e.g. Bella Napoli Trattoria"
          required
          minLength={2}
          maxLength={100}
          value={draft.name}
          onChange={(e) => onChange("name", e.target.value)}
          autoComplete="organization"
          autoFocus
        />
      </div>

      {/* Outlet Type Tiles */}
      <div className="wizard-field-group">
        <label className="wizard-label">
          <span>Outlet Type *</span>
        </label>
        <div className="wizard-type-grid" role="radiogroup" aria-label="Outlet Type">
          {OUTLET_TYPES.map((type) => {
            const isSelected = draft.outletType === type.id;
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={`wizard-type-tile ${isSelected ? "wizard-type-tile--selected" : ""}`}
                onClick={() => {
                  onChange("outletType", type.id);
                  if (type.defaultFulfillment.length) {
                    onChange("fulfillmentModes", type.defaultFulfillment);
                    onChange(
                      "tableCount",
                      ["restaurant", "hotel", "mixed"].includes(type.id)
                        ? draft.tableCount || 10
                        : 0
                    );
                  }
                }}
              >
                <div className="wizard-type-icon">
                  <Icon size={18} />
                </div>
                <div>
                  <div className="wizard-type-name">{type.name}</div>
                  <div className="wizard-type-desc">{type.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Short Story / Description */}
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-desc">
          <span>About your food & concept (optional)</span>
          <span className="wizard-counter">{draft.description.length} / 500</span>
        </label>
        <textarea
          id="wz-desc"
          className="wizard-textarea"
          placeholder="Share your kitchen philosophy, specialties, or dining vibe with visiting guests..."
          maxLength={500}
          value={draft.description}
          onChange={(e) => onChange("description", e.target.value)}
        />
      </div>

      {/* Brand Color Appearance */}
      <div className="wizard-field-group">
        <label className="wizard-label">
          <span>Brand Palette & Accent Color</span>
        </label>
        <div className="wizard-palette-chips">
          {PRESET_PALETTES.map((palette) => {
            const isSelected =
              draft.primaryColor.toLowerCase() === palette.primary.toLowerCase() &&
              draft.secondaryColor.toLowerCase() === palette.secondary.toLowerCase();
            return (
              <button
                key={palette.name}
                type="button"
                className={`wizard-palette-chip ${isSelected ? "wizard-palette-chip--selected" : ""}`}
                onClick={() => {
                  onChange("primaryColor", palette.primary);
                  onChange("secondaryColor", palette.secondary);
                }}
              >
                <span className="wizard-color-dot" style={{ backgroundColor: palette.primary }} />
                <span>{palette.name}</span>
                {isSelected && <Check size={14} className="text-amber-500" />}
              </button>
            );
          })}
        </div>
        <div className="wizard-grid-2" style={{ marginTop: "0.5rem" }}>
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-primary-color">
              <span>Primary Accent (HEX)</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="color"
                value={draft.primaryColor}
                onChange={(e) => onChange("primaryColor", e.target.value)}
                style={{
                  width: "36px",
                  height: "36px",
                  padding: 0,
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
              <input
                id="wz-primary-color"
                className="wizard-input"
                value={draft.primaryColor}
                onChange={(e) => onChange("primaryColor", e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                maxLength={7}
              />
            </div>
          </div>
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-secondary-color">
              <span>Surface / Secondary (HEX)</span>
            </label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                type="color"
                value={draft.secondaryColor}
                onChange={(e) => onChange("secondaryColor", e.target.value)}
                style={{
                  width: "36px",
                  height: "36px",
                  padding: 0,
                  border: "none",
                  cursor: "pointer",
                  background: "transparent",
                }}
              />
              <input
                id="wz-secondary-color"
                className="wizard-input"
                value={draft.secondaryColor}
                onChange={(e) => onChange("secondaryColor", e.target.value)}
                pattern="^#[0-9a-fA-F]{6}$"
                maxLength={7}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
