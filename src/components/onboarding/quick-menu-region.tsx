"use client";

import { localeOptions, suggestedCurrencyForCountry } from "@/modules/onboarding/locales";
import { OutletTimezonePicker } from "./timezone-picker";
import type { WizardDraft } from "./wizard-types";

const suggestions: Record<string, string> = {
  IN: "Asia/Kolkata",
  OM: "Asia/Muscat",
  AE: "Asia/Dubai",
  GB: "Europe/London",
  SG: "Asia/Singapore",
  US: "America/New_York",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  KW: "Asia/Kuwait",
  NZ: "Pacific/Auckland",
};

export function QuickMenuRegion({
  draft,
  onChange,
  onTimezoneSuggestion,
}: {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
  onTimezoneSuggestion: (timezone: string) => void;
}) {
  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 02 / Local Settings</span>
        <h2 className="wizard-title">Choose your restaurant region.</h2>
        <p className="wizard-desc">
          The menu uses this currency for dish prices. Timezone matters for publishing and
          schedules. Please verify both before creating your outlet.
        </p>
      </div>
      <div className="wizard-field-group">
        <label htmlFor="wz-country" className="wizard-label">
          Restaurant country *
        </label>
        <select
          className="wizard-select"
          id="wz-country"
          value={draft.country}
          onChange={(event) => {
            const country = event.target.value;
            onChange("country", country);
            // Require explicit currency selection for countries without a suggestion.
            onChange("currency", suggestedCurrencyForCountry(country));
            if (suggestions[country]) onTimezoneSuggestion(suggestions[country]);
          }}
        >
          {localeOptions().map((region) => (
            <option key={region.code} value={region.code}>
              {region.label} ({region.code})
            </option>
          ))}
        </select>
      </div>
      <div className="wizard-field-group">
        <label htmlFor="wz-currency" className="wizard-label">
          Menu pricing currency *
        </label>
        <select
          id="wz-currency"
          className="wizard-select"
          value={draft.currency}
          onChange={(event) => onChange("currency", event.target.value)}
        >
          <option value="" disabled>
            Select a pricing currency
          </option>
          {Intl.supportedValuesOf("currency").map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
      <OutletTimezonePicker
        id="wz-timezone"
        value={draft.timezone}
        onChange={(timezone) => onChange("timezone", timezone)}
      />
      <p className="wizard-counter">
        You can enter your address, configure tables and opening hours from Outlet Settings and
        Dining Floor later. Online ordering remains disabled unless separately activated.
      </p>
    </div>
  );
}
