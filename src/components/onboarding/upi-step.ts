import { normalizePayeeName, parseUpiId, upiIdFitsQr } from "@/lib/pos/upi";
import type { WizardDraft } from "./wizard-types";

/** The "Get paid by UPI" step is optional: blank fields are fine, filled fields must be valid. */
export function upiStepProblem(draft: Pick<WizardDraft, "upiId" | "upiPayeeName">): string | null {
  if (draft.upiId.trim() && !parseUpiId(draft.upiId))
    return "Enter a valid UPI ID such as name@bank, or clear it to skip this step.";
  if (draft.upiId.trim() && !upiIdFitsQr(draft.upiId))
    return "This UPI ID is too long to fit in the QR code. Check it, or clear it to skip this step.";
  if (draft.upiPayeeName.trim() && !normalizePayeeName(draft.upiPayeeName))
    return "Payee name must be 2 to 40 letters, numbers or . & ' -";
  return null;
}
