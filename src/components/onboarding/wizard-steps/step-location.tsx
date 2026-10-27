"use client";

import { useState } from "react";
import { MapPin, Navigation, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import { localeOptions, currencyFor } from "@/modules/onboarding/locales";
import type { WizardDraft } from "../wizard-types";
import { ThemedArtwork } from "../themed-artwork";

interface StepLocationProps {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
  onTimezoneSuggestion: (timezone: string) => void;
}

const regions = localeOptions();
// These are suggestions, not compulsory timezone overrides for international operators.
const timezoneSuggestions: Record<string, string> = {
  IN: "Asia/Kolkata",
  OM: "Asia/Muscat",
  AE: "Asia/Dubai",
  GB: "Europe/London",
  SG: "Asia/Singapore",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  NZ: "Pacific/Auckland",
};

export function StepLocation({ draft, onChange, onTimezoneSuggestion }: StepLocationProps) {
  const [geoLocating, setGeoLocating] = useState(false);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleDetectGPS = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setGeoLocating(true);
    setGeoError(null);
    setGeoNotice(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLocating(false);
        const lat = Number(position.coords.latitude.toFixed(7));
        const lng = Number(position.coords.longitude.toFixed(7));
        onChange("latitude", lat);
        onChange("longitude", lng);
        setGeoNotice(`Coordinates pinned (accuracy ±${Math.round(position.coords.accuracy)}m)`);
      },
      (error) => {
        setGeoLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGeoError("Location permission denied. You can enter coordinates manually.");
            break;
          case error.POSITION_UNAVAILABLE:
            setGeoError("Location information is unavailable right now.");
            break;
          case error.TIMEOUT:
            setGeoError("Location detection request timed out.");
            break;
          default:
            setGeoError("An unexpected error occurred while locating.");
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const hasCoords = draft.latitude !== null && draft.longitude !== null;
  const osmUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${draft.latitude}&mlon=${draft.longitude}#map=16/${draft.latitude}/${draft.longitude}`
    : null;

  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 02 / Location</span>
        <h2 className="wizard-title">Where is your outlet located?</h2>
        <p className="wizard-desc">
          Add the restaurant address and pin its location. Use GPS only when you are physically at
          the outlet; otherwise enter coordinates manually.
        </p>
      </div>

      <div className="wizard-gps-artwork">
        <ThemedArtwork name="gps-locator" width={800} height={800} />
        <div>
          <strong>Address first, GPS optional</strong>
          <p className="wizard-desc">
            Owners can enter their postal address even when browser GPS is unavailable. Coordinates
            are never mandatory for a QR menu.
          </p>
        </div>
      </div>
      {/* Geolocation Card */}
      <div className="wizard-geo-panel">
        <div className="wizard-geo-head">
          <div className="wizard-geo-title">
            <MapPin size={18} className="text-amber-500" />
            <span>Precise Geocoordinates (GPS)</span>
          </div>
          <button
            type="button"
            className="wizard-locate-btn"
            onClick={handleDetectGPS}
            disabled={geoLocating}
          >
            <Navigation size={14} className={geoLocating ? "animate-spin" : ""} />
            <span>{geoLocating ? "Detecting GPS…" : "Use My Current GPS"}</span>
          </button>
        </div>

        {geoError && (
          <div
            className="wizard-error-banner"
            style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
          >
            <AlertCircle size={16} />
            <span>{geoError}</span>
          </div>
        )}

        {geoNotice && (
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              fontSize: "0.75rem",
              color: "#4ade80",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{geoNotice}</span>
          </div>
        )}

        <div className="wizard-grid-2">
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-lat">
              <span>Latitude (-90.0 to +90.0)</span>
            </label>
            <input
              id="wz-lat"
              type="number"
              step="any"
              min={-90}
              max={90}
              className="wizard-input"
              placeholder="e.g. 19.0760000"
              value={draft.latitude ?? ""}
              onChange={(e) =>
                onChange("latitude", e.target.value === "" ? null : parseFloat(e.target.value))
              }
            />
          </div>
          <div className="wizard-field-group">
            <label className="wizard-label" htmlFor="wz-lng">
              <span>Longitude (-180.0 to +180.0)</span>
            </label>
            <input
              id="wz-lng"
              type="number"
              step="any"
              min={-180}
              max={180}
              className="wizard-input"
              placeholder="e.g. 72.8777000"
              value={draft.longitude ?? ""}
              onChange={(e) =>
                onChange("longitude", e.target.value === "" ? null : parseFloat(e.target.value))
              }
            />
          </div>
        </div>

        {hasCoords && osmUrl && (
          <div className="wizard-geo-readout">
            <span className="wizard-geo-pill">
              {draft.latitude?.toFixed(5)}°, {draft.longitude?.toFixed(5)}°
            </span>
            <a
              href={osmUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                color: "#fed7aa",
                fontSize: "0.75rem",
              }}
            >
              <span>View on OpenStreetMap</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      <div className="wizard-field-group">
        <p className="wizard-counter">
          No exact coordinates? Use the address below. You can verify your restaurant pin later.
        </p>
      </div>
      {/* Street Address */}
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-addr1">
          <span>Address Line 1</span>
        </label>
        <input
          id="wz-addr1"
          className="wizard-input"
          placeholder="Street address, building name, shop number"
          maxLength={180}
          value={draft.addressLine1}
          onChange={(e) => onChange("addressLine1", e.target.value)}
        />
      </div>

      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-addr2">
          <span>Address Line 2 (optional)</span>
        </label>
        <input
          id="wz-addr2"
          className="wizard-input"
          placeholder="Suite, floor, landmark, or delivery gate"
          maxLength={180}
          value={draft.addressLine2}
          onChange={(e) => onChange("addressLine2", e.target.value)}
        />
      </div>

      {/* City, State, Postal Code */}
      <div className="wizard-grid-3">
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-city">
            <span>City</span>
          </label>
          <input
            id="wz-city"
            className="wizard-input"
            placeholder="e.g. Mumbai"
            maxLength={100}
            value={draft.city}
            onChange={(e) => onChange("city", e.target.value)}
          />
        </div>
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-state">
            <span>State / Region</span>
          </label>
          <input
            id="wz-state"
            className="wizard-input"
            placeholder="e.g. Maharashtra"
            maxLength={100}
            value={draft.state}
            onChange={(e) => onChange("state", e.target.value)}
          />
        </div>
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-zip">
            <span>Postal Code</span>
          </label>
          <input
            id="wz-zip"
            className="wizard-input"
            placeholder="e.g. 400001"
            maxLength={24}
            value={draft.postalCode}
            onChange={(e) => onChange("postalCode", e.target.value)}
          />
        </div>
      </div>

      {/* Country Selector */}
      <div className="wizard-field-group">
        <label className="wizard-label" htmlFor="wz-country">
          <span>Country *</span>
        </label>
        <select
          id="wz-country"
          className="wizard-select"
          value={draft.country}
          onChange={(e) => {
            const country = e.target.value;
            onChange("country", country);
            if (currencyFor[country]) onChange("currency", currencyFor[country]);
            // Do not silently replace a timezone the operator already selected.
            if (timezoneSuggestions[country])
              onTimezoneSuggestion(timezoneSuggestions[country]);
          }}
        >
          {regions.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label} ({r.code})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
