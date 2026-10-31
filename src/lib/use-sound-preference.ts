"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  SOUND_PREFERENCE_EVENT,
  SOUND_PREFERENCE_KEY,
  defaultSoundPreference,
  isSoundAudible,
  readSoundPreference,
  snoozedUntil,
  writeSoundPreference,
  type SoundPreference,
} from "./sound-preference";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// useSyncExternalStore needs a referentially stable snapshot, so cache by serialized value.
let cachedKey = "";
let cachedValue: SoundPreference = defaultSoundPreference;
function snapshot(): SoundPreference {
  const next = readSoundPreference(storage());
  const key = JSON.stringify(next);
  if (key !== cachedKey) {
    cachedKey = key;
    cachedValue = next;
  }
  return cachedValue;
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SOUND_PREFERENCE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SOUND_PREFERENCE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SOUND_PREFERENCE_EVENT, onChange);
  };
}

/** The one workspace sound setting, shared across tabs and across every surface. */
export function useSoundPreference() {
  const preference = useSyncExternalStore(subscribe, snapshot, () => defaultSoundPreference);
  const update = useCallback((next: SoundPreference) => {
    writeSoundPreference(storage(), next);
    window.dispatchEvent(new Event(SOUND_PREFERENCE_EVENT));
  }, []);
  return {
    preference,
    audibleNow: () => isSoundAudible(preference, Date.now()),
    setEnabled: (enabled: boolean) => update({ enabled, mutedUntil: null }),
    snooze: (minutes: number) =>
      update({ enabled: true, mutedUntil: snoozedUntil(Date.now(), minutes) }),
    clearSnooze: () => update({ ...preference, mutedUntil: null }),
  };
}
