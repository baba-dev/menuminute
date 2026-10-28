"use client";

import { useState } from "react";
import { Sparkles, MapPin, QrCode, UtensilsCrossed, Package } from "lucide-react";
import type { WizardDraft } from "../wizard-types";
import { outletLocalClock } from "@/lib/outlet-timezones";
import { useEffect } from "react";

interface StepLaunchProps {
  draft: WizardDraft;
  busy: boolean;
  onLaunch: () => Promise<void>;
}

export function StepLaunch({ draft, busy, onLaunch }: StepLaunchProps) {
  const [celebrating, setCelebrating] = useState(false);
  const [confirmedTimezone, setConfirmedTimezone] = useState(false);
  const [confirmedCurrency, setConfirmedCurrency] = useState(false);
  const [localNow, setLocalNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setLocalNow(new Date()), 0);
    const timer = window.setInterval(() => setLocalNow(new Date()), 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);
  const hasCoords = draft.latitude !== null && draft.longitude !== null;
  const handleLaunchClick = async () => {
    setCelebrating(true);
    try {
      await onLaunch();
    } finally {
      setCelebrating(false);
    }
  };
  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 05 / Review & Create</span>
        <h2 className="wizard-title">Review your outlet details.</h2>
        <p className="wizard-desc">
          Creating the outlet prepares a private draft menu and any selected tables. Publish a menu
          and enable eligible ordering features separately.
        </p>
      </div>
      <div className="wizard-review-card">
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
              {draft.name || "Untitled outlet"}
            </h3>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem" }}>
              {draft.outletType.replaceAll("_", " ")} · {draft.country} · {draft.currency} ·{" "}
              {draft.timezone}
            </p>
          </div>
          {draft.description && <p>{draft.description}</p>}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              fontSize: "0.8125rem",
            }}
          >
            {draft.addressLine1 && (
              <div>
                <MapPin
                  size={14}
                  aria-hidden="true"
                  style={{ display: "inline", marginRight: 6 }}
                />
                {[draft.addressLine1, draft.city, draft.state].filter(Boolean).join(", ")}
              </div>
            )}
            {hasCoords && (
              <div>
                GPS: {draft.latitude?.toFixed(5)}°, {draft.longitude?.toFixed(5)}°
              </div>
            )}
            <div>
              <UtensilsCrossed
                size={14}
                aria-hidden="true"
                style={{ display: "inline", marginRight: 6 }}
              />
              Dine-in: {draft.fulfillmentModes.includes("dine_in") ? "Selected" : "Off"}
            </div>
            <div>
              <Package size={14} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />
              Pickup: {draft.fulfillmentModes.includes("pickup") ? "Selected" : "Off"}
            </div>
            {draft.fulfillmentModes.includes("dine_in") && draft.tableCount > 0 && (
              <div>
                {draft.tableCount} table records will be created. Generate table QR codes in Print
                Studio afterward.
              </div>
            )}
          </div>
        </div>
        <div className="wizard-qr-preview-box">
          <strong>QR MENU</strong>
          <div
            className="wizard-qr-canvas"
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <QrCode size={64} color="#292524" aria-hidden="true" />
          </div>
          <span style={{ fontSize: "0.75rem" }}>
            Your scannable menu QR is issued with the outlet. Publish your menu before sharing it
            with guests.
          </span>
        </div>
      </div>
      <div className="wizard-content">
        <label className="wizard-label">
          <input
            type="checkbox"
            checked={confirmedTimezone}
            onChange={(event) => setConfirmedTimezone(event.target.checked)}
          />{" "}
          I confirm the operating timezone ({draft.timezone}) matches my restaurant location.
        </label>
        <label className="wizard-label">
          <input
            type="checkbox"
            checked={confirmedCurrency}
            onChange={(event) => setConfirmedCurrency(event.target.checked)}
          />{" "}
          I confirm {draft.currency} is the currency in which my menu prices will be entered.
        </label>
        {localNow && (
          <p className="wizard-counter">
            Restaurant local time: {outletLocalClock(draft.timezone, localNow)}
          </p>
        )}
        <p className="wizard-counter">
          This setting controls schedules and daily order reporting. It can be changed later without
          rewriting historical orders.
        </p>
      </div>
      {celebrating && (
        <p role="status">
          <Sparkles size={16} aria-hidden="true" style={{ display: "inline", marginRight: 6 }} />
          Creating your private outlet workspace…
        </p>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="wizard-primary-btn wizard-launch-btn"
          disabled={
            busy ||
            celebrating ||
            !confirmedTimezone ||
            !confirmedCurrency ||
            draft.name.trim().length < 2
          }
          onClick={handleLaunchClick}
        >
          <Sparkles size={16} aria-hidden="true" />
          {busy || celebrating ? "Creating outlet…" : "Confirm & Create Outlet"}
        </button>
      </div>
    </div>
  );
}
