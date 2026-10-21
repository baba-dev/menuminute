/**
 * Account recognition only. Never store a session ID, signed cookie, password,
 * access token or user profile here. This hint is untrusted and cannot authorize.
 */
const rememberedKey = "menuminute.remembered-email.v1";
const pendingKey = "menuminute.pending-login.v1";

function validEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

export function readRememberedAccount(): string | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(rememberedKey) ?? "null");
    return validEmail(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearRememberedAccount() {
  try {
    localStorage.removeItem(rememberedKey);
  } catch {}
}

export function stageLoginPreference(email: string, rememberMe: boolean) {
  try {
    sessionStorage.setItem(pendingKey, JSON.stringify({ email, rememberMe }));
  } catch {}
}

export function discardPendingLoginPreference() {
  try {
    sessionStorage.removeItem(pendingKey);
  } catch {}
}

/** Only call after Better Auth confirms the completed sign-in, including MFA. */
export function completePendingLoginPreference() {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(pendingKey) ?? "null");
    if (!value || typeof value !== "object") return;
    const preference = value as { email?: unknown; rememberMe?: unknown };
    if (preference.rememberMe === true && validEmail(preference.email))
      localStorage.setItem(rememberedKey, JSON.stringify(preference.email.trim().toLowerCase()));
    else clearRememberedAccount();
  } catch {
    // Blocked browser storage must not prevent sign-in.
  } finally {
    discardPendingLoginPreference();
  }
}
