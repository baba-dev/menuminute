"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultPopupPreference,
  parsePopupPreference,
  type PopupKind,
  type PopupPreference,
} from "@/modules/dashboard/ember-popups";

export const POPUP_PREFERENCE_KEY = "menuminute.ember-popups.v1";
const CHANGE = "mm:ember-popup-preference";

function read(): PopupPreference {
  try {
    return parsePopupPreference(window.localStorage.getItem(POPUP_PREFERENCE_KEY));
  } catch {
    return defaultPopupPreference;
  }
}

/** Per-viewer convenience only: browser storage may be unavailable and pop-ups then stay on. */
export function usePopupPreference() {
  const [preference, setPreference] = useState<PopupPreference>(defaultPopupPreference);
  useEffect(() => {
    const sync = () => setPreference(read());
    const first = window.setTimeout(sync, 0);
    window.addEventListener(CHANGE, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener(CHANGE, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const write = useCallback((next: PopupPreference) => {
    try {
      window.localStorage.setItem(POPUP_PREFERENCE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the choice applies until reload */
    }
    setPreference(next);
    window.dispatchEvent(new Event(CHANGE));
  }, []);
  return {
    preference,
    setEnabled: (enabled: boolean) => write({ ...preference, enabled }),
    setKind: (kind: PopupKind, on: boolean) =>
      write({ ...preference, kinds: { ...preference.kinds, [kind]: on } }),
  };
}
