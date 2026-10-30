/**
 * Models occasionally return a wire-format function call as ordinary answer text.
 * Such payloads are not business answers. We never execute or show them, including
 * when an older completed turn is reloaded from history.
 *
 * This check intentionally accepts Markdown and treats any complete JSON document
 * as an internal/structured response that needs proper formatting, not display.
 * The provider is never retried here (a retry could incur an additional charge).
 */
export function isInternalAssistantPayload(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  const unfenced = text
    .replace(/^\`\`\`(?:json|javascript|js)?\s*\n?/i, "")
    .replace(/\n?\`\`\`\s*$/, "")
    .trim();
  if (!(unfenced.startsWith("{") || unfenced.startsWith("["))) return false;
  try {
    const parsed: unknown = JSON.parse(unfenced);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}
