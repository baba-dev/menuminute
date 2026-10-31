import { describe, expect, it } from "vitest";
import {
  SOUND_PREFERENCE_KEY,
  defaultSoundPreference,
  isSoundAudible,
  pageHasOwnAudio,
  parseSoundPreference,
  readSoundPreference,
  snoozedUntil,
  writeSoundPreference,
} from "../src/lib/sound-preference";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("unified sound preference", () => {
  it("is off by default and when storage is unavailable", () => {
    expect(readSoundPreference(memoryStorage())).toEqual(defaultSoundPreference);
    expect(readSoundPreference(null)).toEqual(defaultSoundPreference);
    const broken = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(readSoundPreference(broken)).toEqual(defaultSoundPreference);
  });

  it("rejects malformed stored values instead of trusting them", () => {
    expect(parseSoundPreference("not json")).toBeNull();
    expect(parseSoundPreference('"on"')).toBeNull();
    expect(parseSoundPreference('{"enabled":"yes"}')).toBeNull();
    expect(parseSoundPreference('{"enabled":true,"mutedUntil":"soon"}')).toEqual({
      enabled: true,
      mutedUntil: null,
    });
  });

  it("round-trips a saved preference", () => {
    const storage = memoryStorage();
    writeSoundPreference(storage, { enabled: true, mutedUntil: 123 });
    expect(readSoundPreference(storage)).toEqual({ enabled: true, mutedUntil: 123 });
  });

  it.each([
    ["orders board", { "menuminute.orders.sound": "enabled" }],
    ["kitchen board", { "menuminute.kitchen.sound": "true" }],
    ["kitchen intake", { "menuminute.kitchen.intake.sound": "true" }],
    ["a per-outlet POS switch", { "mm.pos.sound.outlet-9": "on" }],
  ])("carries forward an old %s switch once and removes the old keys", (_name, legacy) => {
    const storage = memoryStorage({ ...legacy, "mm.pos.sound.other": "off", unrelated: "keep" });
    expect(readSoundPreference(storage)).toEqual({ enabled: true, mutedUntil: null });
    expect(storage.data.has(SOUND_PREFERENCE_KEY)).toBe(true);
    expect(
      [...storage.data.keys()].filter((k) => k.includes("sound") && k !== SOUND_PREFERENCE_KEY)
    ).toEqual([]);
    expect(storage.data.get("unrelated")).toBe("keep");
  });

  it("does not migrate when every old switch was off, and never overrides a saved choice", () => {
    const off = memoryStorage({ "menuminute.orders.sound": "disabled", "mm.pos.sound.o": "off" });
    expect(readSoundPreference(off)).toEqual(defaultSoundPreference);
    expect(off.data.has(SOUND_PREFERENCE_KEY)).toBe(false);
    const chosen = memoryStorage({
      [SOUND_PREFERENCE_KEY]: JSON.stringify({ enabled: false, mutedUntil: null }),
      "menuminute.orders.sound": "enabled",
    });
    expect(readSoundPreference(chosen).enabled).toBe(false);
  });

  it("is audible only when on and not snoozed, and a snooze expires on its own", () => {
    const now = 1_000_000;
    expect(isSoundAudible({ enabled: false, mutedUntil: null }, now)).toBe(false);
    expect(isSoundAudible({ enabled: true, mutedUntil: null }, now)).toBe(true);
    const snoozed = { enabled: true, mutedUntil: snoozedUntil(now, 60) };
    expect(isSoundAudible(snoozed, now)).toBe(false);
    expect(isSoundAudible(snoozed, now + 59 * 60_000)).toBe(false);
    expect(isSoundAudible(snoozed, now + 60 * 60_000)).toBe(true);
  });

  it("knows which pages already chime for their own events", () => {
    for (const path of [
      "/kitchen",
      "/dashboard/orders",
      "/dashboard/pos",
      "/dashboard/pos/closing",
    ])
      expect(pageHasOwnAudio(path)).toBe(true);
    for (const path of ["/dashboard", "/dashboard/menu", "/dashboard/floor", "/dashboard/reports"])
      expect(pageHasOwnAudio(path)).toBe(false);
  });
});
