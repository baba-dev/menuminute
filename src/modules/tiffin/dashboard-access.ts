import { TIFFIN_OUTLET_TYPE, tiffinFlagEnabled } from "./contracts";

/** Fail closed: unset, "false" and any malformed TIFFIN_ENABLED value all mean off. */
export function tiffinFlagOn(): boolean {
  try {
    return tiffinFlagEnabled();
  } catch {
    return false;
  }
}

/**
 * Server-side decision for the dashboard: the Tiffin destination exists only for a tiffin
 * outlet while the feature flag is on. Callers pass the result to client code as plain data.
 */
export function tiffinNavEnabled(outletType: string | null | undefined): boolean {
  return outletType === TIFFIN_OUTLET_TYPE && tiffinFlagOn();
}
