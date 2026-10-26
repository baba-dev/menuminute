"use client";

import { Phone, Mail, Globe, LayoutGrid, Minus, Plus } from "lucide-react";
import type { WizardDraft } from "../wizard-types";

interface StepContactTablesProps {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}

export function StepContactTables({ draft, onChange }: StepContactTablesProps) {
  const isDineIn = draft.fulfillmentModes.includes("dine_in");

  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 04 / Service Points</span>
        <h2 className="wizard-title">Guest contact & dining tables.</h2>
        <p className="wizard-desc">
          Provide public contact details for guest queries and optionally provision your initial
          dining tables.
        </p>
      </div>

      {/* Contact Inputs */}
      <div className="wizard-grid-2">
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-phone">
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Phone size={14} className="text-amber-500" />
              <span>Public Phone / WhatsApp</span>
            </span>
          </label>
          <input
            id="wz-phone"
            type="tel"
            className="wizard-input"
            placeholder="+91 98765 43210"
            maxLength={40}
            value={draft.phone}
            onChange={(e) => onChange("phone", e.target.value)}
          />
        </div>

        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-email">
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Mail size={14} className="text-amber-500" />
              <span>Public Inquiries Email</span>
            </span>
          </label>
          <input
            id="wz-email"
            type="email"
            className="wizard-input"
            placeholder="orders@yourrestaurant.com"
            maxLength={254}
            value={draft.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </div>
      </div>

      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-website">
          <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Globe size={14} className="text-amber-500" />
            <span>Public Website or Instagram URL</span>
          </span>
        </label>
        <input
          id="wz-website"
          type="url"
          className="wizard-input"
          placeholder="https://instagram.com/yourrestaurant"
          maxLength={512}
          value={draft.website}
          onChange={(e) => onChange("website", e.target.value)}
        />
      </div>

      <details className="wizard-optional-details">
        <summary>Private operations contact (optional)</summary>
        <p className="wizard-counter">
          Used for internal follow-up and setup. Never shown on public menus.
        </p>
        <div className="wizard-grid-2">
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-ops-name">
              Manager name
            </label>
            <input
              id="wz-ops-name"
              className="wizard-input"
              maxLength={120}
              autoComplete="name"
              value={draft.operationsContactName}
              onChange={(e) => onChange("operationsContactName", e.target.value)}
            />
          </div>
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-ops-phone">
              Manager phone
            </label>
            <input
              id="wz-ops-phone"
              className="wizard-input"
              maxLength={40}
              autoComplete="tel"
              type="tel"
              value={draft.operationsContactPhone}
              onChange={(e) => onChange("operationsContactPhone", e.target.value)}
            />
          </div>
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-ops-email">
              Manager email
            </label>
            <input
              id="wz-ops-email"
              className="wizard-input"
              maxLength={254}
              autoComplete="email"
              type="email"
              value={draft.operationsContactEmail}
              onChange={(e) => onChange("operationsContactEmail", e.target.value)}
            />
          </div>
        </div>
      </details>
      {/* Dine-In Tables Provisioning */}
      {isDineIn ? (
        <div className="wizard-geo-panel">
          <div className="wizard-geo-title">
            <LayoutGrid size={18} className="text-amber-500" />
            <span>Auto-Provision Initial Dining Tables</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#a8a29e", lineHeight: 1.4 }}>
            We can create {draft.tableCount} initial table records. After creating your outlet, use
            Print Studio to generate the table-specific QR codes.
          </p>

          <div className="wizard-counter-box">
            <button
              type="button"
              className="wizard-counter-btn"
              disabled={draft.tableCount <= 0}
              onClick={() => onChange("tableCount", Math.max(0, draft.tableCount - 1))}
              aria-label="Decrease tables"
            >
              <Minus size={16} />
            </button>
            <div className="wizard-counter-val">{draft.tableCount}</div>
            <button
              type="button"
              className="wizard-counter-btn"
              disabled={draft.tableCount >= 50}
              onClick={() => onChange("tableCount", Math.min(50, draft.tableCount + 1))}
              aria-label="Increase tables"
            >
              <Plus size={16} />
            </button>
            <input
              type="range"
              min={0}
              max={50}
              value={draft.tableCount}
              onChange={(e) => onChange("tableCount", parseInt(e.target.value, 10))}
              style={{ flex: 1, accentColor: "#f97316" }}
            />
            <span style={{ fontSize: "0.8125rem", color: "#fed7aa", fontWeight: 600 }}>
              {draft.tableCount === 0 ? "No tables now" : `${draft.tableCount} Tables`}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "0.875rem",
            background: "#201d1c",
            border: "1px solid #383432",
            borderRadius: "10px",
            fontSize: "0.8125rem",
            color: "#a8a29e",
          }}
        >
          <span>
            Table provisioning is skipped because Dine-In is not selected. You can add service
            points anytime in Outlet Settings.
          </span>
        </div>
      )}
    </div>
  );
}
