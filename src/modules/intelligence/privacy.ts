/**
 * Defense in depth for personal information accidentally entered in a prompt.
 * The stored first-party conversation remains unchanged; only the third-party
 * inference message is minimized. This is not a guarantee of full PII detection.
 */
export function minimizeProviderPrompt(text: string): string {
  return text
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9._~-]{8,}\b/gi, "[credential removed]")
    .replace(/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g, "[credential removed]")
    .replace(/\b(?:https?:\/\/)[^\s<>"']+/gi, "[link removed]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email removed]")
    .replace(/\b(?:\+?\d[\s.-]?){10,15}\b/g, "[phone removed]")
    .replace(/\b[A-Za-z0-9_-]{42,}\b/g, "[identifier removed]");
}
