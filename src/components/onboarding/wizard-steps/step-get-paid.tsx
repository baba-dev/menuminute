"use client";

import { QrCode } from "lucide-react";
import { PayBlockPreview } from "@/components/pos/pay-block-preview";
import { normalizePayeeName, parseUpiId, samplePayBlock } from "@/lib/pos/upi";
import { upiStepProblem } from "../upi-step";
import type { WizardDraft } from "../wizard-types";

interface StepGetPaidProps {
  draft: WizardDraft;
  onChange: <K extends keyof WizardDraft>(key: K, value: WizardDraft[K]) => void;
}

/** Optional step: the merchant's own UPI ID, printed as a pre-filled QR on unpaid INR bills.
 * Nothing is processed or confirmed by MenuMinute; staff still record payments in the till.
 */
export function StepGetPaid({ draft, onChange }: StepGetPaidProps) {
  const problem = upiStepProblem(draft);
  const upiId = parseUpiId(draft.upiId);
  const payee = normalizePayeeName(draft.upiPayeeName) ?? normalizePayeeName(draft.name) ?? "";
  const preview = upiId && payee ? samplePayBlock(upiId, payee) : null;

  return (
    <div className="wizard-content">
      <div className="wizard-header">
        <span className="wizard-eyebrow">Step 05 / Get paid</span>
        <h2 className="wizard-title">Get paid by UPI.</h2>
        <p className="wizard-desc">
          Optional. Add your UPI ID and unpaid thermal bills print a Scan &amp; Pay QR that opens
          your customer&apos;s UPI app with the amount filled in. Staff still record the payment in
          the till. You can also do this later in Settings.
        </p>
      </div>
      {draft.currency !== "INR" && (
        <p className="wizard-desc" role="status">
          UPI works in Indian rupees, so the QR prints only on INR bills. This outlet bills in{" "}
          {draft.currency}.
        </p>
      )}
      <div className="wizard-grid-2">
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-upi-id">
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <QrCode size={14} className="text-amber-500" />
              <span>UPI ID</span>
            </span>
          </label>
          <input
            id="wz-upi-id"
            className="wizard-input"
            placeholder="yourname@bank"
            maxLength={120}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={draft.upiId}
            onChange={(e) => onChange("upiId", e.target.value)}
            aria-invalid={Boolean(problem)}
          />
        </div>
        <div className="wizard-field-group">
          <label className="wizard-label" htmlFor="wz-upi-name">
            <span>Payee name</span>
          </label>
          <input
            id="wz-upi-name"
            className="wizard-input"
            placeholder={normalizePayeeName(draft.name) ?? "Your restaurant"}
            maxLength={60}
            value={draft.upiPayeeName}
            onChange={(e) => onChange("upiPayeeName", e.target.value)}
          />
        </div>
      </div>
      {problem && (
        <p className="wizard-desc" role="alert">
          {problem}
        </p>
      )}
      {preview && (
        <div aria-label="Printed bill preview">
          <p className="wizard-desc">A sample 80 mm bill for Rs 840.00:</p>
          <PayBlockPreview block={preview} paper="80" />
        </div>
      )}
    </div>
  );
}
