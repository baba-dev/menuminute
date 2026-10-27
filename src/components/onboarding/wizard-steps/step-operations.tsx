"use client";
import { UtensilsCrossed, Package, Clock, CalendarDays, HelpCircle } from "lucide-react";
import { OutletTimezonePicker } from "../timezone-picker";
import { BusinessHoursEditor } from "../business-hours-editor";
import type { WizardDraft } from "../wizard-types";

const currencies = Intl.supportedValuesOf("currency");
export function StepOperations({
  draft,
  onChange,
}: {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}) {
  const hasPickup = draft.fulfillmentModes.includes("pickup");
  const toggle = (mode: "dine_in" | "pickup") => {
    const active = draft.fulfillmentModes.includes(mode);
    if (active && draft.fulfillmentModes.length === 1) return;
    onChange(
      "fulfillmentModes",
      active ? draft.fulfillmentModes.filter((m) => m !== mode) : [...draft.fulfillmentModes, mode]
    );
    if (mode === "dine_in" && active) onChange("tableCount", 0);
  };
  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 03 / Operations</span>
        <h2 className="wizard-title">How will your restaurant operate?</h2>
        <p className="wizard-desc">
          Choose your service model and operating timezone. You can finish advanced scheduling
          later.
        </p>
      </div>
      <div className="wizard-field-group">
        <label className="wizard-label">Service types</label>
        <div className="wizard-modes-grid">
          {(
            [
              {
                id: "dine_in",
                name: "Dine-in",
                Icon: UtensilsCrossed,
                desc: "Guests at tables or service counters.",
              },
              {
                id: "pickup",
                name: "Pickup / takeaway",
                Icon: Package,
                desc: "Orders collected at the restaurant.",
              },
            ] as const
          ).map((mode) => (
            <label
              key={mode.id}
              className={`wizard-mode-card ${draft.fulfillmentModes.includes(mode.id) ? "wizard-mode-card--active" : ""}`}
            >
              <input
                className="wizard-mode-checkbox"
                type="checkbox"
                checked={draft.fulfillmentModes.includes(mode.id)}
                onChange={() => toggle(mode.id)}
              />
              <div>
                <strong>
                  <mode.Icon size={16} aria-hidden="true" /> {mode.name}
                </strong>
                <p>{mode.desc}</p>
              </div>
            </label>
          ))}
        </div>
        <span className="wizard-counter">
          These are initial preferences, not automatic paid-feature activation.
        </span>
      </div>
      <div className="wizard-grid-2">
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-currency">
            Menu pricing currency *
          </label>
          <select
            className="wizard-select"
            id="wz-currency"
            value={draft.currency}
            onChange={(e) => onChange("currency", e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="wizard-counter">
            Independent of MenuMinute subscription billing currency.
          </span>
        </div>
        <OutletTimezonePicker
          id="wz-timezone"
          value={draft.timezone}
          onChange={(timezone) => onChange("timezone", timezone)}
        />
      </div>
      <BusinessHoursEditor
        value={draft.operatingHours}
        onChange={(v) => onChange("operatingHours", v)}
      />
      <details className="wizard-optional-details">
        <summary>
          <CalendarDays size={16} aria-hidden="true" /> Advanced service hours (optional)
        </summary>
        <p className="wizard-counter">
          Order acceptance windows are distinct from business opening hours and menu visibility.
          Setup does not enable ordering.
        </p>
        <BusinessHoursEditor
          mode="service"
          value={draft.serviceHours}
          onChange={(v) => onChange("serviceHours", v)}
        />
      </details>
      {hasPickup && (
        <details className="wizard-optional-details">
          <summary>
            <Clock size={16} aria-hidden="true" /> Pickup timing (suggested defaults)
          </summary>
          <p className="wizard-counter">
            Configure pickup lead time, slot length and ordering horizon before activating pickup
            ordering.
          </p>
          <div className="wizard-grid-3">
            {(
              [
                {
                  id: "pickupLeadMinutes",
                  label: "Preparation notice",
                  min: 0,
                  max: 240,
                  description: "Minutes before collection",
                },
                {
                  id: "pickupSlotMinutes",
                  label: "Pickup intervals",
                  min: 5,
                  max: 120,
                  description: "Minutes between slots",
                },
                {
                  id: "pickupAdvanceDays",
                  label: "Advance booking",
                  min: 1,
                  max: 30,
                  description: "Days ahead allowed",
                },
              ] as const
            ).map((f) => (
              <div className="wizard-field-group" key={f.id}>
                <label className="wizard-label" htmlFor={f.id}>
                  {f.label}
                </label>
                <input
                  id={f.id}
                  className="wizard-input"
                  type="number"
                  min={f.min}
                  max={f.max}
                  value={draft[f.id]}
                  onChange={(e) => onChange(f.id, Number(e.target.value))}
                />
                <span className="wizard-counter">{f.description}</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="wizard-privacy-note">
        <HelpCircle size={16} aria-hidden="true" />
        Restaurant hours and order-acceptance hours are saved independently. Live checkout still
        follows its own authorization and availability safeguards.
      </div>
    </div>
  );
}
