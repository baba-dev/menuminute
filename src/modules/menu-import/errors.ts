import { AppError } from "@/lib/errors";
import { domainError } from "@/modules/organizations/service";

/**
 * The import commands raise a distinct message for each refusal, but several share one SQLSTATE.
 * Mapping by SQLSTATE alone told an owner who had simply reached a limit to "check the account,
 * scope and settings; currency changes with existing prices require repricing". Each known refusal
 * gets its own sentence saying what happened and what to do next. Only the wording changes: the
 * HTTP status still follows the SQLSTATE exactly as before (a refusal on authority stays 403).
 */
const STATUS: Record<string, number> = { "42501": 403, "40001": 409, "22023": 422, "54000": 503 };
const REFUSALS: Record<string, [message: string, code: string]> = {
  "Too many active imports": [
    "You already have 5 unfinished imports. Cancel or finish one under Recent imports, then start again.",
    "IMPORT_ACTIVE_LIMIT",
  ],
  "Hourly import source limit exceeded": [
    "You have uploaded 30 photos in the last hour, which is the limit. Wait a while and try again. Photos already uploaded are safe.",
    "IMPORT_HOURLY_LIMIT",
  ],
  "Retained import storage budget exhausted": [
    "Your unfinished imports already hold 30 photos. Cancel or finish an older import to make room.",
    "IMPORT_STORAGE_LIMIT",
  ],
  "Import source limit exceeded": [
    "This import is full (12 photos or 30 MiB). Start another import for the remaining pages.",
    "IMPORT_FULL",
  ],
  "Invalid source": [
    "This photo could not be accepted. Choose a JPEG, PNG or WebP photo.",
    "IMPORT_SOURCE_INVALID",
  ],
  "Invalid normalized source": [
    "This photo could not be prepared for import. Try a different photo of the page.",
    "IMPORT_SOURCE_INVALID",
  ],
  "Source unavailable": [
    "This page's upload could not be completed. Remove it and add the photo again.",
    "IMPORT_SOURCE_MISSING",
  ],
  "Source key conflict": [
    "This page was already uploaded with a different photo. Remove it and add the photo again.",
    "IMPORT_SOURCE_CONFLICT",
  ],
  "Source completion conflict": [
    "This page was already uploaded with a different photo. Remove it and add the photo again.",
    "IMPORT_SOURCE_CONFLICT",
  ],
  "Import not collecting": [
    "This import no longer accepts photos because it was already submitted, cancelled or finished. Start a new import.",
    "IMPORT_CLOSED",
  ],
  "Import key conflict": [
    "This import was already created. Refresh the page to continue with it.",
    "IMPORT_DUPLICATE",
  ],
  "Target menu unavailable": [
    "The menu you chose to import into is no longer available. Start the import again from Menu Studio.",
    "IMPORT_TARGET_MISSING",
  ],
  "Import unavailable": [
    "This import could not be found for the selected outlet.",
    "IMPORT_NOT_FOUND",
  ],
  "Stale import revision": [
    "This import changed in another tab or device. Refresh to see its current state, then try again.",
    "IMPORT_STALE",
  ],
  "Stale revision": [
    "This import changed in another tab or device. Refresh to see its current state, then try again.",
    "IMPORT_STALE",
  ],
  "Candidate revision changed": [
    "The extracted draft changed while you were reviewing. Refresh to load the latest version.",
    "IMPORT_STALE",
  ],
  "Import cannot be cancelled": [
    "This import has already finished, so there is nothing to cancel.",
    "IMPORT_FINISHED",
  ],
  "Import already submitted": [
    "This import was already sent for reading. Refresh to see its progress.",
    "IMPORT_ALREADY_SUBMITTED",
  ],
  "Finish every source upload before processing": [
    "Finish uploading every photo, or remove the ones that failed, before starting.",
    "IMPORT_UPLOADS_PENDING",
  ],
  "Daily import engine limit": [
    "Your organization has used today's 20 menu readings. Try again tomorrow.",
    "IMPORT_DAILY_LIMIT",
  ],
  "Import is not reviewable": [
    "This import is not ready for review. Refresh to see its current state.",
    "IMPORT_NOT_REVIEWABLE",
  ],
  "Invalid reviewed document": [
    "The review could not be saved because it no longer matches the extracted draft. Refresh and try again.",
    "IMPORT_REVIEW_INVALID",
  ],
  "Invalid confirmations": [
    "The review could not be saved because it no longer matches the extracted draft. Refresh and try again.",
    "IMPORT_REVIEW_INVALID",
  ],
  "Candidate structure or confirmation mismatch": [
    "The review could not be saved because it no longer matches the extracted draft. Refresh and try again.",
    "IMPORT_REVIEW_INVALID",
  ],
  "Every field needs human confirmation": [
    "Confirm every heading, dish and price against the photo before finishing the review.",
    "IMPORT_REVIEW_INCOMPLETE",
  ],
  "Review must be confirmed before application": [
    "Finish the review before adding these dishes to a menu.",
    "IMPORT_REVIEW_INCOMPLETE",
  ],
  "No confirmed fields": [
    "Finish the review before adding these dishes to a menu.",
    "IMPORT_REVIEW_INCOMPLETE",
  ],
  "Target changed": [
    "This import belongs to a different menu and cannot be added to this one.",
    "IMPORT_TARGET_MISMATCH",
  ],
  "New menu identity conflict": [
    "A menu was already created from this import. Refresh to open it.",
    "IMPORT_ALREADY_APPLIED",
  ],
  "Menu is unavailable or its revision changed": [
    "The menu changed or was archived while you were reviewing. Refresh and add the dishes again.",
    "IMPORT_MENU_CHANGED",
  ],
};

/** Turns a refused import command into one clear sentence; anything unknown keeps its old mapping. */
export function importDomainError(error: unknown): never {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const raised =
    typeof inner === "object" && inner !== null && "message" in inner
      ? String((inner as { message: unknown }).message)
      : "";
  const state =
    typeof inner === "object" && inner !== null && "code" in inner
      ? String((inner as { code: unknown }).code)
      : "";
  const refusal = REFUSALS[raised];
  const status = STATUS[state];
  if (refusal && status) throw new AppError(refusal[0], refusal[1], status);
  domainError(error);
}
