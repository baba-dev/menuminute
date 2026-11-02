import { ValidationError } from "@/lib/errors";

export type PlanActionResult = { ok: true } | { ok: false; message: string };

/** Do not leak SQL errors, connection strings, or server action details to operators. */
export function planFailureMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;
  let current: unknown = error;
  for (let i = 0; i < 4; i++) {
    if (!current || typeof current !== "object") break;
    const msg = "message" in current && typeof current.message === "string"
      ? current.message : "";
    if (msg.includes("Confirm a recent privileged action"))
      return "Confirm a privileged action using your password and authenticator code, then save again. The confirmation is valid once.";
    if (msg.includes("global commercial release is not approved"))
      return "Approve the one-time Kitchen Pro platform launch in Kitchen Control Desk first.";
    if (msg.includes("price differs from reviewed payment catalog"))
      return "Kitchen Pro pricing does not match the verified provider plan. Reconcile billing before publishing.";
    if (msg.includes("Administrative request key conflict"))
      return "This plan change conflicts with a previous request. Refresh and try again.";
    current = "cause" in current ? current.cause : undefined;
  }
  return "The plan update could not be confirmed. Refresh the catalog status and check your privileged confirmation before retrying.";
}
