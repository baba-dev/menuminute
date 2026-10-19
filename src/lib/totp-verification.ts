import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an authenticator code against the secret in Better Auth's *server-side*
 * password-protected TOTP URI. Never return this URI, key or expected code to a client.
 * This is for step-up on an ALREADY authenticated session: the native verify-totp
 * endpoint is a sign-in/enrollment challenge and cannot start a fresh step-up there.
 */
export function verifyStepUpTotp(uri: string, candidate: string, now = Date.now()) {
  if (!/^\d{6}$/.test(candidate)) return false;
  const config = new URL(uri);
  if (config.protocol !== "otpauth:" || config.hostname !== "totp") return false;
  const encoded = config.searchParams.get("secret");
  if (!encoded) return false;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const octets: number[] = [];
  let value = 0;
  let bits = 0;
  for (const letter of encoded.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(letter);
    if (digit < 0) return false;
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      octets.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  if (octets.length < 10) return false;
  const key = Buffer.from(octets);
  const submitted = Buffer.from(candidate, "ascii");
  const step = Math.floor(now / 30000);
  // Match Better Auth's one-period clock-skew tolerance, but never a wider window.
  for (const delta of [-1, 0, 1]) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step + delta));
    const digest = createHmac("sha1", key).update(counter).digest();
    const offset = digest[digest.length - 1]! & 15;
    const expected = ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
      .toString()
      .padStart(6, "0");
    if (timingSafeEqual(submitted, Buffer.from(expected, "ascii"))) return true;
  }
  return false;
}
