import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getPool } from "@/db";
import { NotFoundError } from "@/lib/errors";

/** Opaque, httpOnly device cookie. Only the SHA-256 of the token is ever stored. */
export const DEVICE_COOKIE = "menuminute.guest";
export const DEVICE_COOKIE_MAX_AGE_SECONDS = 180 * 24 * 60 * 60;
/** Version of the diner-facing notice shown beside the opt-in. Bump when its meaning changes. */
export const DEVICE_NOTICE_VERSION = "2026-11-02";

const tokenShape = /^[A-Za-z0-9_-]{43}$/;
const menuToken = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const rememberSchema = z
  .object({
    token: menuToken,
    name: z.string().trim().max(80).default(""),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?[0-9]{8,15})?$/, "Enter the phone number using digits only")
      .default(""),
    // Keep the phone already saved on this device (used when only the name changed).
    keepPhone: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.name !== "" || v.phone !== "", "Enter a name or phone number to remember");

export type SavedContact = { name: string; phone: string };

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}
/** Returns null for a malformed cookie so it is treated exactly like no cookie. */
export function hashDeviceToken(value: string | undefined | null) {
  if (!value || !tokenShape.test(value)) return null;
  return createHash("sha256").update(value).digest("hex");
}
export function maskPhone(phone: string) {
  return phone.length > 4 ? "•••• " + phone.slice(-4) : phone ? "••••" : "";
}

export async function lookupSavedContact(
  token: string,
  cookieValue: string | undefined | null
): Promise<SavedContact | null> {
  const hash = hashDeviceToken(cookieValue);
  if (!hash) return null;
  menuToken.parse(token);
  const result = await getPool().query<{ data: SavedContact | null }>(
    "select app_private.guest_device_lookup($1,$2) as data",
    [token, hash]
  );
  return result.rows[0]?.data ?? null;
}

export async function rememberDevice(
  raw: unknown,
  cookieValue: string | undefined | null
): Promise<{ cookieToken: string }> {
  const input = rememberSchema.parse(raw);
  if (input.keepPhone && !input.phone) {
    input.phone = (await lookupSavedContact(input.token, cookieValue))?.phone ?? "";
    if (!input.name && !input.phone) throw new NotFoundError("Saved contact");
  }
  // Reuse a well-formed existing cookie token so a re-save updates the same device row.
  const cookieToken = hashDeviceToken(cookieValue) ? (cookieValue as string) : newDeviceToken();
  const hash = hashDeviceToken(cookieToken)!;
  try {
    await getPool().query("select app_private.guest_device_remember($1,$2,$3,$4,$5)", [
      input.token,
      hash,
      input.name,
      input.phone,
      DEVICE_NOTICE_VERSION,
    ]);
  } catch (error) {
    if (error instanceof Error && /Menu unavailable|demo does not store/.test(error.message))
      throw new NotFoundError("Menu");
    throw error;
  }
  return { cookieToken };
}

export async function forgetDevice(cookieValue: string | undefined | null) {
  const hash = hashDeviceToken(cookieValue);
  if (!hash) return false;
  const result = await getPool().query<{ forgotten: boolean }>(
    "select app_private.guest_device_forget($1) as forgotten",
    [hash]
  );
  return Boolean(result.rows[0]?.forgotten);
}
