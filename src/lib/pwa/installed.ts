export function matchesInstalledAppContext(input: {
  standalone: boolean;
  fullscreen: boolean;
  iosStandalone: boolean;
  referrer: string;
}): boolean {
  const twaOrigin = "android-app://com.bababuilds.menuminute";
  const twa =
    input.referrer === twaOrigin ||
    input.referrer.startsWith(twaOrigin + "/");
  return input.standalone || input.fullscreen || input.iosStandalone || twa;
}

/** Shared browser capability boundary for Chrome-installed PWAs and trusted Android clients.
 * This is UI-only detection, NEVER proof of payment or account authorization.
 */
export function isInstalledAppClient(): boolean {
  if (typeof window === "undefined") return false;
  return matchesInstalledAppContext({
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    fullscreen: window.matchMedia("(display-mode: fullscreen)").matches,
    iosStandalone: Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    referrer: document.referrer,
  });
}
