import { z } from "zod";

/**
 * Diner contact details for the public checkout.
 *
 * Interim, device-local convenience (explicit opt-in, expires after 90 days). It is replaced by the
 * server-side device token in a later slice; nothing here is sent to the server except through the
 * normal order submission, and the server stays the authority for validation.
 */
export const GUEST_PROFILE_KEY = "menuminute.guest-profile.v1";
export const GUEST_PROFILE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const profileSchema = z
  .object({
    name: z.string().max(80),
    phone: z.string().max(30),
    savedAt: z.number().int().positive(),
  })
  .strict();

export type GuestProfile = { name: string; phone: string };

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Keeps a leading "+" and digits only; drops spaces, dashes, dots and brackets. */
export function cleanPhoneInput(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}

/** Empty is allowed (phone is optional). Returns a diner-facing problem or null. */
export function phoneProblem(raw: string): string | null {
  if (!raw.trim()) return null;
  if (/[^\d\s+().-]/.test(raw)) return "Use digits only, for example +91 98765 43210.";
  const cleaned = cleanPhoneInput(raw);
  if (raw.trim().indexOf("+") > 0) return "A + can only be at the start of the number.";
  const digitCount = cleaned.replace(/\D/g, "").length;
  if (digitCount < 8) return "That phone number looks too short.";
  if (digitCount > 15) return "That phone number looks too long.";
  return null;
}

export function readGuestProfile(
  storage: StorageLike,
  now: number = Date.now()
): GuestProfile | null {
  try {
    const raw = storage.getItem(GUEST_PROFILE_KEY);
    if (!raw) return null;
    const parsed = profileSchema.parse(JSON.parse(raw));
    if (now - parsed.savedAt > GUEST_PROFILE_TTL_MS || parsed.savedAt > now + 60_000) {
      storage.removeItem(GUEST_PROFILE_KEY);
      return null;
    }
    return { name: parsed.name, phone: parsed.phone };
  } catch {
    try {
      storage.removeItem(GUEST_PROFILE_KEY);
    } catch {
      /* storage unavailable */
    }
    return null;
  }
}

export function writeGuestProfile(
  storage: StorageLike,
  profile: GuestProfile,
  now: number = Date.now()
) {
  try {
    if (!profile.name.trim() && !profile.phone.trim()) {
      storage.removeItem(GUEST_PROFILE_KEY);
      return;
    }
    storage.setItem(
      GUEST_PROFILE_KEY,
      JSON.stringify({
        name: profile.name.trim().slice(0, 80),
        phone: profile.phone.trim().slice(0, 30),
        savedAt: now,
      })
    );
  } catch {
    /* private mode or quota: remembering is best-effort */
  }
}

export function clearGuestProfile(storage: StorageLike) {
  try {
    storage.removeItem(GUEST_PROFILE_KEY);
  } catch {
    /* storage unavailable */
  }
}
