import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { ValidationError } from "@/lib/errors";
import { sourceByteLimit } from "./contracts";

export const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const privateKey = /^imports\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/;
function resolveKey(key: string) {
  if (!privateKey.test(key)) throw new Error("Invalid private import key");
  // Live media is the existing persistent, private shared web/worker volume.
  if (process.env["MEDIA_STORAGE"] !== "local")
    throw new Error("Import storage requires configured private local media");
  const root = process.env["MEDIA_ROOT"];
  if (!root || !path.isAbsolute(root)) throw new Error("Explicit absolute media root required");
  return path.join(root, key);
}
export async function normalizeSource(
  bytes: Buffer
): Promise<{ bytes: Buffer; width: number; height: number }> {
  if (!bytes.length || bytes.length > sourceByteLimit)
    throw new ValidationError("Choose a photo up to 5 MiB");
  try {
    const image = sharp(bytes, { limitInputPixels: 10_000_000, failOn: "error" });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
      (meta.pages ?? 1) !== 1 ||
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 10_000_000
    )
      throw new ValidationError("Choose a static JPEG, PNG or WebP photo up to 10 megapixels");
    const normalized = await image
      .rotate()
      .webp({ quality: 90, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (
      normalized.data.length > sourceByteLimit ||
      normalized.info.width * normalized.info.height > 10_000_000
    )
      throw new ValidationError("Processed photo exceeds the import limit");
    return { bytes: normalized.data, width: normalized.info.width, height: normalized.info.height };
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    throw new ValidationError("The photograph could not be decoded");
  }
}
/** Idempotent private put. link() refuses to overwrite an existing source after retries. */
export async function putPrivateSource(key: string, bytes: Buffer) {
  if (!bytes.length || bytes.length > sourceByteLimit)
    throw new Error("Processed source exceeds limit");
  const file = resolveKey(key);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o2770 });
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temporary, bytes, { flag: "wx", mode: 0o660 });
    try {
      await fs.link(temporary, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await getPrivateSource(key);
      if (digest(existing) !== digest(bytes)) throw new Error("Private source collision");
    }
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
export async function getPrivateSource(key: string) {
  const file = resolveKey(key);
  const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > sourceByteLimit)
    throw new Error("Invalid stored import source");
  return fs.readFile(file);
}
