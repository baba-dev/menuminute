import { ValidationError } from "@/lib/errors";

export type GrantActionResult = { ok: true } | { ok: false; message: string };

/** Never forward database query text or unexpected exception details to the browser. */
export function grantFailureMessage(error: unknown): string {
  if (error instanceof ValidationError) return error.message;

  // Drizzle wraps PostgreSQL errors inside .cause, sometimes more than once.
  let cause: unknown = error;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof cause !== "object" || cause === null) break;
    const message = "message" in cause && typeof cause.message === "string" ? cause.message : "";
    if (message.includes("Confirm a recent privileged action")) {
      return "Confirm a privileged action with your password and authenticator at Account & Security, then retry this grant. Each confirmation works once and expires after five minutes.";
    }
    if (message.includes("Overlapping entitlement already exists")) {
      return "This organization already has an overlapping grant for that capability. Check the current grants before retrying.";
    }
    if (message.includes("Kitchen Pro commercial activation is not approved")) {
      return "Kitchen Pro activation is blocked until its independent release checks are complete.";
    }
    if (
      message.includes("Active organization required") ||
      message.includes("Unknown organization")
    ) {
      return "The target organization does not exist or is not active.";
    }
    if (message.includes("Only current or scheduled grants can be renewed") || message.includes("Renewal must end")) {
      return "This grant cannot be extended with the selected date. Refresh its history and choose a later end date.";
    }
    if (message.includes("Invalid UTC entitlement window")) {
      return "The grant must have an end date after the start date and in the future.";
    }
    cause = "cause" in cause ? cause.cause : undefined;
  }

  // The operation might have committed before a response was lost; don't imply a rollback.
  return "The grant could not be confirmed. Refresh the grant list before retrying. If it is absent, reconfirm your privileged action and try again.";
}
