"use client";
import { useId } from "react";
import { phoneProblem } from "@/modules/orders/guest-profile";

/**
 * Optional diner details for checkout. Every field stays optional (the server decides what an
 * outlet requires); the phone gets inline format feedback so a typo is caught before submission.
 */
export function GuestDetails({
  name,
  phone,
  notes,
  remember,
  hasSavedProfile,
  phoneTouched,
  savedPhoneMasked = null,
  disabled = false,
  onName,
  onPhone,
  onPhoneBlur,
  onNotes,
  onRemember,
  onForget,
}: {
  name: string;
  phone: string;
  notes: string;
  remember: boolean;
  hasSavedProfile: boolean;
  phoneTouched: boolean;
  savedPhoneMasked?: string | null;
  disabled?: boolean;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onPhoneBlur: () => void;
  onNotes: (value: string) => void;
  onRemember: (value: boolean) => void;
  onForget: () => void;
}) {
  const ids = useId();
  const phoneError = phoneTouched ? phoneProblem(phone) : null;
  const phoneHelp = ids + "-phone-help";
  const notesHelp = ids + "-notes-help";
  return (
    <div
      className="cart-section stack guest-details"
      style={{ gap: "0.6rem", marginTop: "0.5rem" }}
    >
      <span className="section-title">Your details (optional)</span>
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <div className="stack" style={{ flex: "1 1 12rem", minWidth: 0, gap: "0.25rem" }}>
          <label htmlFor={ids + "-name"}>Name</label>
          <input
            id={ids + "-name"}
            type="text"
            placeholder="So we can call your order"
            value={name}
            maxLength={80}
            autoComplete="name"
            disabled={disabled}
            onChange={(event) => onName(event.target.value)}
            className="field-input"
          />
        </div>
        <div className="stack" style={{ flex: "1 1 12rem", minWidth: 0, gap: "0.25rem" }}>
          <label htmlFor={ids + "-phone"}>Phone number</label>
          <input
            id={ids + "-phone"}
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={phone}
            maxLength={30}
            autoComplete="tel"
            disabled={disabled}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={phoneHelp}
            onChange={(event) => onPhone(event.target.value)}
            onBlur={onPhoneBlur}
            className="field-input"
          />
          <small
            id={phoneHelp}
            className={phoneError ? "error" : "quiet"}
            role={phoneError ? "alert" : undefined}
          >
            {phoneError ??
              (savedPhoneMasked
                ? `Saved ${savedPhoneMasked}. Leave blank to use it, or enter a new number.`
                : "Used only for this order. Not a marketing sign-up.")}
          </small>
        </div>
      </div>
      <div className="stack" style={{ gap: "0.25rem" }}>
        <label htmlFor={ids + "-notes"}>Order instructions</label>
        <textarea
          id={ids + "-notes"}
          rows={2}
          placeholder="Allergies or special requests for the kitchen"
          value={notes}
          maxLength={500}
          disabled={disabled}
          aria-describedby={notesHelp}
          onChange={(event) => onNotes(event.target.value)}
          className="field-input"
        />
        <small id={notesHelp} className="quiet">
          {notes.length}/500 · A request for the kitchen, not a guarantee about allergens.
        </small>
      </div>
      <label className="row" style={{ gap: "0.6rem", alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={remember}
          disabled={disabled}
          onChange={(event) => onRemember(event.target.checked)}
          style={{ marginTop: "0.25rem", minHeight: "20px", minWidth: "20px" }}
        />
        <span className="stack" style={{ gap: "0.1rem" }}>
          <span>Remember my name and phone on this device</span>
          <small className="quiet">
            Saved for this restaurant for up to 6 months, or 90 days in this browser if saving to
            the restaurant is off. Instructions are never saved. You can forget it anytime.
          </small>
        </span>
      </label>
      {hasSavedProfile && (
        <button
          type="button"
          className="action"
          style={{ alignSelf: "start", minHeight: "44px" }}
          disabled={disabled}
          onClick={onForget}
        >
          Forget saved details
        </button>
      )}
    </div>
  );
}
