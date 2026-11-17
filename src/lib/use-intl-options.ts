"use client";

import { useSyncExternalStore } from "react";
import { localeOptions } from "@/modules/onboarding/locales";

const subscribe = () => () => undefined;
const NONE: readonly string[] = [];
let cached: readonly string[] | null = null;
const clientList = () => (cached ??= Intl.supportedValuesOf("currency"));
const serverList = () => NONE;

/**
 * ISO currency codes for a `<select>`, safe to server-render.
 *
 * `Intl.supportedValuesOf("currency")` depends on the runtime's ICU data, so Node and the
 * visitor's browser disagree on the list (and its length). Rendering it directly made the server
 * HTML differ from the client and React discarded the whole form on hydration. The server and the
 * hydration pass therefore render only the selected code; the browser's full list follows.
 */
export function useSupportedCurrencies(selected?: string): readonly string[] {
  const list = useSyncExternalStore(subscribe, clientList, serverList);
  return selected && !list.includes(selected) ? [selected, ...list] : list;
}

type RegionOption = { code: string; label: string };
const NO_REGIONS: readonly RegionOption[] = [];
let cachedRegions: readonly RegionOption[] | null = null;
const clientRegions = () => (cachedRegions ??= localeOptions());
const serverRegions = () => NO_REGIONS;

/**
 * Country options for a `<select>`, safe to server-render.
 *
 * Region display names (and therefore their sort order) also come from ICU: Node says
 * "Falkland Islands" where Chrome says "Falkland Islands (Islas Malvinas)". The server and the
 * hydration pass render only the selected country; put `suppressHydrationWarning` on the
 * `<option>` so a differing label for that one entry is tolerated.
 */
export function useRegionOptions(selected?: string): readonly RegionOption[] {
  const list = useSyncExternalStore(subscribe, clientRegions, serverRegions);
  if (list.length || !selected) return list;
  let label = selected;
  try {
    label = new Intl.DisplayNames(["en"], { type: "region" }).of(selected) ?? selected;
  } catch {
    // An unknown stored code is still shown as-is rather than breaking the form.
  }
  return [{ code: selected, label }];
}
