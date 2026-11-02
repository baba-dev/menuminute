import { describe, expect, it } from "vitest";
import {
  GUEST_PROFILE_KEY,
  GUEST_PROFILE_TTL_MS,
  cleanPhoneInput,
  clearGuestProfile,
  phoneProblem,
  readGuestProfile,
  writeGuestProfile,
} from "@/modules/orders/guest-profile";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    has: (key: string) => data.has(key),
  };
}

describe("guest phone input", () => {
  it("cleans separators and keeps only a leading plus", () => {
    expect(cleanPhoneInput(" +91 (98765) 432-10 ")).toBe("+919876543210");
    expect(cleanPhoneInput("98765.43210")).toBe("9876543210");
  });
  it("treats an empty phone as valid because it is optional", () => {
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem("   ")).toBeNull();
  });
  it("accepts 8 to 15 digits and rejects the rest", () => {
    expect(phoneProblem("+91 98765 43210")).toBeNull();
    expect(phoneProblem("1234567")).toMatch(/too short/);
    expect(phoneProblem("1234567890123456")).toMatch(/too long/);
    expect(phoneProblem("98765x43210")).toMatch(/digits only/);
    expect(phoneProblem("98765+43210")).toMatch(/start/);
  });
});

describe("remembered guest profile", () => {
  it("round-trips name and phone only", () => {
    const storage = memoryStorage();
    writeGuestProfile(storage, { name: " Asha ", phone: "+919876543210" }, 1_000);
    expect(readGuestProfile(storage, 2_000)).toEqual({ name: "Asha", phone: "+919876543210" });
    expect(JSON.parse(storage.getItem(GUEST_PROFILE_KEY)!)).not.toHaveProperty("notes");
  });
  it("expires after 90 days and removes the stale entry", () => {
    const storage = memoryStorage();
    writeGuestProfile(storage, { name: "Asha", phone: "" }, 1_000);
    expect(readGuestProfile(storage, 1_000 + GUEST_PROFILE_TTL_MS + 1)).toBeNull();
    expect(storage.has(GUEST_PROFILE_KEY)).toBe(false);
  });
  it("drops corrupt or unexpected stored data", () => {
    const corrupt = memoryStorage({ [GUEST_PROFILE_KEY]: "{not json" });
    expect(readGuestProfile(corrupt)).toBeNull();
    expect(corrupt.has(GUEST_PROFILE_KEY)).toBe(false);
    const extra = memoryStorage({
      [GUEST_PROFILE_KEY]: JSON.stringify({ name: "A", phone: "", savedAt: 5, token: "x" }),
    });
    expect(readGuestProfile(extra, 10)).toBeNull();
  });
  it("clears on forget, and never stores an empty profile", () => {
    const storage = memoryStorage();
    writeGuestProfile(storage, { name: "", phone: "  " });
    expect(storage.has(GUEST_PROFILE_KEY)).toBe(false);
    writeGuestProfile(storage, { name: "Asha", phone: "" });
    clearGuestProfile(storage);
    expect(storage.has(GUEST_PROFILE_KEY)).toBe(false);
  });
  it("survives storage that throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readGuestProfile(broken)).toBeNull();
    expect(() => writeGuestProfile(broken, { name: "A", phone: "" })).not.toThrow();
    expect(() => clearGuestProfile(broken)).not.toThrow();
  });
});
