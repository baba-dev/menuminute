import { describe, expect, it } from "vitest";
import { matchesInstalledAppContext } from "../src/lib/pwa/installed";

const browser = {
  standalone: false,
  fullscreen: false,
  iosStandalone: false,
  referrer: "",
};

describe("installed Android and PWA detection", () => {
  it("recognizes installed Chrome PWAs, full-screen TWAs, and iOS standalone", () => {
    expect(matchesInstalledAppContext({ ...browser, standalone: true })).toBe(true);
    expect(matchesInstalledAppContext({ ...browser, fullscreen: true })).toBe(true);
    expect(matchesInstalledAppContext({ ...browser, iosStandalone: true })).toBe(true);
    expect(
      matchesInstalledAppContext({
        ...browser,
        referrer: "android-app://com.bababuilds.menuminute/",
      })
    ).toBe(true);
  });

  it("does not treat arbitrary websites or spoof-prefix app IDs as installed clients", () => {
    expect(matchesInstalledAppContext(browser)).toBe(false);
    expect(
      matchesInstalledAppContext({
        ...browser,
        referrer: "android-app://com.bababuilds.menuminute.attacker/",
      })
    ).toBe(false);
  });
});
