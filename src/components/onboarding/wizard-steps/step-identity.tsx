"use client";

import {
  Utensils,
  Coffee,
  ShoppingBag,
  Flame,
  Hotel,
  Sparkles,
  Check,
  QrCode,
  ShoppingCart,
  ClipboardList,
} from "lucide-react";
import Image from "next/image";
import type { KeyboardEvent } from "react";
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
    desc: "Pickup-focused kitchen without a dining room. Delivery integrations are not yet available.",
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

/** WAI-ARIA radio keyboard navigation: arrow keys, Home and End. */
function moveRadio(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key))
    return;
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
  );
  const index = radios.indexOf(event.target as HTMLButtonElement);
  if (index < 0 || !radios.length) return;
  event.preventDefault();
  const target =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? radios.length - 1
        : (index +
            (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) +
            radios.length) %
          radios.length;
  radios[target]?.focus();
  radios[target]?.click();
}
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

      {/* A setup goal personalizes the next steps, never grants entitlements. */}
      <div className="wizard-field-group">
        <label className="wizard-label">What would you like to start with?</label>
        <div
          className="wizard-goal-grid"
          role="radiogroup"
          aria-label="Initial setup goal"
          onKeyDown={moveRadio}
        >
          {(
            [
              {
                id: "qr_menu",
                label: "Free QR Menu",
                Icon: QrCode,
                desc: "Build and publish a digital menu.",
              },
              {
                id: "ordering",
                label: "Online Ordering",
                Icon: ShoppingCart,
                desc: "Prepare menus and pickup operations.",
              },
              {
                id: "full_operations",
                label: "Restaurant Operations",
                Icon: ClipboardList,
                desc: "Work toward ordering, kitchen and POS.",
              },
            ] as const
          ).map((option) => (
            <button
              className={`wizard-goal-choice ${draft.onboardingGoal === option.id ? "wizard-goal-choice--selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={draft.onboardingGoal === option.id}
              tabIndex={draft.onboardingGoal === option.id ? 0 : -1}
              key={option.id}
              onClick={() => onChange("onboardingGoal", option.id)}
            >
              <option.Icon size={19} aria-hidden="true" />
              <strong>{option.label}</strong>
              <span>{option.desc}</span>
            </button>
          ))}
        </div>
        <p className="wizard-counter">
          Your selection personalizes the setup checklist. Paid services require separate
          activation.
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
        <div
          className="wizard-type-grid"
          role="radiogroup"
          aria-label="Outlet Type"
          onKeyDown={moveRadio}
        >
          {OUTLET_TYPES.map((type) => {
            const isSelected = draft.outletType === type.id;
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
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
                  <Icon size={18} className="wizard-type-fallback" />
                  <Image
                    src={`/brand/onboarding-wizard/icons/outlet-type-${type.id.replaceAll("_", "-")}.svg`}
                    alt=""
                    width={35}
                    height={35}
                    unoptimized
                    className="wizard-type-image"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
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

      <p className="wizard-counter">
        You can change the description and branding after creating your workspace.
      </p>
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
                aria-label="Choose primary accent color"
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
                aria-label="Choose secondary surface color"
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
