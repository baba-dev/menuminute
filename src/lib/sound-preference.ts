/**
 * One sound setting for the whole workspace, replacing the separate orders, kitchen,
 * kitchen-intake and per-outlet POS switches. A per-viewer convenience: it lives only in this
 * browser, every storage access is guarded, and the app works with it unavailable.
 */
export type SoundPreference = {
  enabled: boolean;
  /** Epoch ms until which sound is snoozed, or null. */
  mutedUntil: number | null;
};

export const SOUND_PREFERENCE_KEY = "menuminute.sound.v1";
export const SOUND_PREFERENCE_EVENT = "mm:sound-preference";

const LEGACY_FIXED_KEYS: readonly [key: string, on: string][] = [
  ["menuminute.orders.sound", "enabled"],
  ["menuminute.kitchen.sound", "true"],
  ["menuminute.kitchen.intake.sound", "true"],
];
const LEGACY_POS_PREFIX = "mm.pos.sound.";

type ReadableStorage = Pick<Storage, "getItem">;
type FullStorage = ReadableStorage & Pick<Storage, "setItem" | "removeItem" | "length" | "key">;

export const defaultSoundPreference: SoundPreference = { enabled: false, mutedUntil: null };

export function parseSoundPreference(raw: string | null): SoundPreference | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { enabled, mutedUntil } = value as Record<string, unknown>;
    if (typeof enabled !== "boolean") return null;
    return {
      enabled,
      mutedUntil: typeof mutedUntil === "number" && Number.isFinite(mutedUntil) ? mutedUntil : null,
    };
  } catch {
    return null;
  }
}

/** Is any of the old per-surface switches on? Used once, to carry a user's choice forward. */
export function legacyPreferenceEnabled(storage: FullStorage): boolean {
  try {
    if (LEGACY_FIXED_KEYS.some(([key, on]) => storage.getItem(key) === on)) return true;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_POS_PREFIX) && storage.getItem(key) === "on") return true;
    }
  } catch {
    return false;
  }
  return false;
}

function removeLegacy(storage: FullStorage) {
  try {
    for (const [key] of LEGACY_FIXED_KEYS) storage.removeItem(key);
    const stale: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(LEGACY_POS_PREFIX)) stale.push(key);
    }
    for (const key of stale) storage.removeItem(key);
  } catch {
    // Leaving a legacy key behind is harmless: the unified key wins from now on.
  }
}

/**
 * Reads the unified preference. If it has never been written but an old switch was on, the
 * user's choice is carried forward once and the old keys are removed so they cannot diverge.
 */
export function readSoundPreference(storage: FullStorage | null): SoundPreference {
  if (!storage) return defaultSoundPreference;
  let stored: SoundPreference | null = null;
  try {
    stored = parseSoundPreference(storage.getItem(SOUND_PREFERENCE_KEY));
  } catch {
    return defaultSoundPreference;
  }
  if (stored) return stored;
  if (!legacyPreferenceEnabled(storage)) return defaultSoundPreference;
  const migrated: SoundPreference = { enabled: true, mutedUntil: null };
  try {
    storage.setItem(SOUND_PREFERENCE_KEY, JSON.stringify(migrated));
    removeLegacy(storage);
  } catch {
    // Storage is read-only: still honour the old choice for this page view.
  }
  return migrated;
}

export function writeSoundPreference(
  storage: Pick<Storage, "setItem"> | null,
  next: SoundPreference
): void {
  try {
    storage?.setItem(SOUND_PREFERENCE_KEY, JSON.stringify(next));
  } catch {
    // Not persisted; the in-memory state for this page view still applies.
  }
}

/** Sound is audible only when switched on and not snoozed. */
export function isSoundAudible(preference: SoundPreference, now: number): boolean {
  if (!preference.enabled) return false;
  return preference.mutedUntil === null || preference.mutedUntil <= now;
}

export function snoozedUntil(now: number, minutes: number): number {
  return now + minutes * 60_000;
}

/** Pages that already chime for their own events; the shell stays quiet there to avoid doubles. */
export function pageHasOwnAudio(pathname: string): boolean {
  return (
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    pathname === "/dashboard/orders" ||
    pathname.startsWith("/dashboard/orders/") ||
    pathname === "/dashboard/pos" ||
    pathname.startsWith("/dashboard/pos/")
  );
}
