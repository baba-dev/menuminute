/**
 * Shift summary is a *draft* produced through Ember's existing read-only turn pipeline
 * (budget reservation, scope re-checks, audit and evidence capture are inherited). The
 * prompt below is a constant, but the endpoint accepts any prompt from the signed-in user,
 * so nothing here is an authorization boundary: the draft is advisory and never sent anywhere.
 */
export function shiftSummaryPrompt(localDate: string): string {
  // Ember routes each question to tools by keyword (see tool-selection.ts). This wording is
  // deliberately limited so only the orders, kitchen and dining-table tools are shortlisted:
  // avoid sales words (which pull in the reports tool), "draft"/"menu" (menu tools) and
  // "food"/"dish" (dish lookup), and never interpolate a merchant-chosen name.
  return [
    `Write a short shift summary for the manager for ${localDate} (today so far).`,
    "Use only values returned by the registered tools about orders, the kitchen and dining tables.",
    'Format: one headline sentence, up to six short bullet points, then one "Check before sharing" line.',
    "Do not state money amounts of any kind; order totals are not settled.",
    "Do not make dietary, allergen or safety claims.",
    "Say plainly when a figure is missing. Do not invent numbers, names or reasons.",
  ].join(" ");
}

export type SummaryEvidence = {
  tool?: string;
  source?: string;
  capturedAt?: string;
  data?: unknown;
};

const NUMBER = /\d+(?:[.,]\d+)*/g;

/** Every digit group the evidence contains, so derived text can be checked against it. */
function evidenceNumbers(evidence: unknown): Set<string> {
  const found = new Set<string>();
  const text = JSON.stringify(evidence ?? null);
  for (const match of text.match(NUMBER) ?? []) found.add(match.replace(/,/g, ""));
  // ISO timestamps contribute their parts (2027-01-02T09:30) so a quoted time still matches.
  for (const part of text.split(/[^\d]+/)) if (part) found.add(part.replace(/^0+(?=\d)/, ""));
  return found;
}

/**
 * Figures in the draft that do not appear anywhere in the evidence. Leading list markers
 * ("1.", "2)") are ignored. This is a warning aid for the reviewer, not a proof of accuracy.
 */
export function unsupportedFigures(draft: string, evidence: unknown): string[] {
  const allowed = evidenceNumbers(evidence);
  const body = draft.replace(/^\s*\d+[.)]\s+/gm, "");
  const unsupported = new Set<string>();
  for (const raw of body.match(NUMBER) ?? []) {
    const token = raw.replace(/,/g, "");
    const trimmed = token.replace(/^0+(?=\d)/, "");
    if (!allowed.has(token) && !allowed.has(trimmed)) unsupported.add(raw);
  }
  return [...unsupported];
}

export function summaryFileName(outletName: string, localDate: string) {
  const slug =
    outletName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "outlet";
  return `shift-summary-${slug}-${localDate || "today"}.txt`;
}
