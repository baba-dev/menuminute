"use client";

import type { WizardDraft } from "./wizard-types";

const outletTypes = [
  { id: "restaurant", label: "Restaurant", mode: "dine_in" },
  { id: "cafe", label: "Café or bakery", mode: "pickup" },
  { id: "takeout", label: "Takeaway", mode: "pickup" },
  { id: "cloud_kitchen", label: "Cloud kitchen", mode: "pickup" },
  { id: "hotel", label: "Hotel dining", mode: "dine_in" },
  { id: "mixed", label: "Mixed hospitality", mode: "dine_in" },
] as const;

export function QuickMenuIdentity({
  draft,
  onChange,
}: {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}) {
  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 01 / Your Restaurant</span>
        <h2 className="wizard-title">What should we call your menu?</h2>
        <p className="wizard-desc">Start with a name and type of business. Photos, branding, address and tables can come later.</p>
      </div>
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-name">Restaurant name *</label>
        <input
          className="wizard-input"
          id="wz-name"
          minLength={2}
          maxLength={100}
          autoComplete="organization"
          required
          value={draft.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="e.g. My Café"
        />
      </div>
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-quick-type">Type of food business</label>
        <select
          className="wizard-select"
          id="wz-quick-type"
          value={draft.outletType}
          onChange={(event) => {
            const type = outletTypes.find((item) => item.id === event.target.value);
            if (!type) return;
            onChange("outletType", type.id);
            onChange("fulfillmentModes", [type.mode]);
          }}
        >
          {outletTypes.map((type) => <option value={type.id} key={type.id}>{type.label}</option>)}
        </select>
      </div>
      <p className="wizard-counter">No payment card required. This creates a private menu draft; guests will not see it until you publish.</p>
    </div>
  );
}
