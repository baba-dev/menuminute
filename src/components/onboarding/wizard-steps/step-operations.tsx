"use client";

import { UtensilsCrossed, Package, Clock, CalendarDays } from "lucide-react";
import { ScheduleEditor } from "@/components/menu-product/schedule-editor";
import { timezoneOptions } from "@/modules/onboarding/locales";
import type { WizardDraft } from "../wizard-types";

interface StepOperationsProps {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}

const currencies = Intl.supportedValuesOf("currency");
const timezones = timezoneOptions();

export function StepOperations({ draft, onChange }: StepOperationsProps) {
  const toggleFulfillment = (mode: "dine_in" | "pickup") => {
    const exists = draft.fulfillmentModes.includes(mode);
    if (exists) {
      if (draft.fulfillmentModes.length > 1) {
        onChange(
          "fulfillmentModes",
          draft.fulfillmentModes.filter((m) => m !== mode)
        );
      }
    } else {
      onChange("fulfillmentModes", [...draft.fulfillmentModes, mode]);
    }
  };

  const hasPickup = draft.fulfillmentModes.includes("pickup");

  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 03 / Operations</span>
        <h2 className="wizard-title">Service model & trading hours.</h2>
        <p className="wizard-desc">
          Choose how you serve diners, set your billing currency, and configure ordering horizons.
        </p>
      </div>

      {/* Fulfillment Modes */}
      <div className="wizard-field-group">
        <label className="wizard-label">
          <span>Fulfillment Channels *</span>
        </label>
        <div className="wizard-modes-grid">
          <label
            className={`wizard-mode-card ${draft.fulfillmentModes.includes("dine_in") ? "wizard-mode-card--active" : ""}`}
          >
            <input
              type="checkbox"
              className="wizard-mode-checkbox"
              checked={draft.fulfillmentModes.includes("dine_in")}
              onChange={() => toggleFulfillment("dine_in")}
            />
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                <UtensilsCrossed size={16} className="text-amber-500" />
                <span>Dine-In</span>
              </div>
              <p
                style={{
                  margin: "0.25rem 0 0 0",
                  fontSize: "0.75rem",
                  color: "#a8a29e",
                  lineHeight: 1.35,
                }}
              >
                Guests scan tabletop QR codes to browse the menu and order directly to their table.
              </p>
            </div>
          </label>

          <label
            className={`wizard-mode-card ${draft.fulfillmentModes.includes("pickup") ? "wizard-mode-card--active" : ""}`}
          >
            <input
              type="checkbox"
              className="wizard-mode-checkbox"
              checked={draft.fulfillmentModes.includes("pickup")}
              onChange={() => toggleFulfillment("pickup")}
            />
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
              >
                <Package size={16} className="text-amber-500" />
                <span>Pickup / Takeaway</span>
              </div>
              <p
                style={{
                  margin: "0.25rem 0 0 0",
                  fontSize: "0.75rem",
                  color: "#a8a29e",
                  lineHeight: 1.35,
                }}
              >
                Guests place orders ahead of time for scheduled collection or counter pickup.
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Currency & Timezone */}
      <div className="wizard-grid-2">
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-currency">
            <span>Menu & Billing Currency *</span>
          </label>
          <select
            id="wz-currency"
            className="wizard-select"
            value={draft.currency}
            onChange={(e) => onChange("currency", e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-timezone">
            <span>Operating Timezone *</span>
          </label>
          <select
            id="wz-timezone"
            className="wizard-select"
            value={draft.timezone}
            onChange={(e) => onChange("timezone", e.target.value)}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pickup Scheduling (only if pickup enabled) */}
      {hasPickup && (
        <div className="wizard-geo-panel">
          <div className="wizard-geo-title">
            <Clock size={16} className="text-amber-500" />
            <span>Pickup Scheduling Parameters</span>
          </div>
          <div className="wizard-grid-3">
            <div className="wizard-field-group">
              <label className="wizard-label" htmlFor="wz-lead">
                <span>Lead Time</span>
              </label>
              <input
                id="wz-lead"
                type="number"
                min={0}
                max={240}
                className="wizard-input"
                value={draft.pickupLeadMinutes}
                onChange={(e) => onChange("pickupLeadMinutes", parseInt(e.target.value, 10) || 0)}
              />
              <span className="wizard-counter">Prep minutes required</span>
            </div>

            <div className="wizard-field-group">
              <label className="wizard-label" htmlFor="wz-slot">
                <span>Slot Window</span>
              </label>
              <input
                id="wz-slot"
                type="number"
                min={5}
                max={120}
                className="wizard-input"
                value={draft.pickupSlotMinutes}
                onChange={(e) => onChange("pickupSlotMinutes", parseInt(e.target.value, 10) || 15)}
              />
              <span className="wizard-counter">Interval per slot</span>
            </div>

            <div className="wizard-field-group">
              <label className="wizard-label" htmlFor="wz-advance">
                <span>Advance Days</span>
              </label>
              <input
                id="wz-advance"
                type="number"
                min={1}
                max={30}
                className="wizard-input"
                value={draft.pickupAdvanceDays}
                onChange={(e) => onChange("pickupAdvanceDays", parseInt(e.target.value, 10) || 7)}
              />
              <span className="wizard-counter">Max ordering horizon</span>
            </div>
          </div>
        </div>
      )}

      {/* Operating Schedule */}
      <div className="wizard-field-group">
        <details
          style={{
            background: "#201d1c",
            border: "1px solid #383432",
            borderRadius: "10px",
            padding: "0.875rem",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#fed7aa",
            }}
          >
            <CalendarDays size={16} />
            <span>Configure Weekly Opening Hours (optional)</span>
          </summary>
          <div style={{ marginTop: "1rem" }}>
            <ScheduleEditor
              value={draft.menuSchedule}
              onChange={(sched) => onChange("menuSchedule", sched)}
            />
          </div>
        </details>
      </div>
    </div>
  );
}
