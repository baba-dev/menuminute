import sharp from "sharp";
import type { Pool } from "pg";
import { putObject, getObject } from "./storage";
export async function processMedia(pool: Pool, eventId: string, organizationId: string) {
  const prepare = await pool.query("select app_private.media_job($1,$2) as data", [
    eventId,
    organizationId,
  ]);
  const asset = prepare.rows[0]?.data;
  if (asset?.done) return false;
  if (!asset?.sourceKey) throw new Error("Invalid media work");
  const original = await getObject(asset.sourceKey);
  let display: Buffer, thumb: Buffer, width: number, height: number;
  try {
    const jpeg = original[0] === 255 && original[1] === 216 && original[2] === 255;
    const png = original.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      original.subarray(0, 4).toString() === "RIFF" &&
      original.subarray(8, 12).toString() === "WEBP";
    if (!jpeg && !png && !webp) throw new Error("Unsupported signature");

    const meta = await sharp(original, {
      limitInputPixels: 10000000,
      failOn: "warning",
    }).metadata();
    if (!["jpeg", "png", "webp"].includes(meta.format ?? "") || (meta.pages ?? 1) > 1)
      throw new Error("Unsupported raster");
    const result = await sharp(original, { limitInputPixels: 10000000, failOn: "warning" })
      .rotate()
      .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    display = result.data;
    width = result.info.width;
    height = result.info.height;
    thumb = await sharp(display)
      .resize(480, 480, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
  } catch {
    await pool.query("select app_private.media_job($1,$2,$3::jsonb)", [
      eventId,
      organizationId,
      JSON.stringify({ error: "invalid_image" }),
    ]);
    return false;
  }
  const key = `${organizationId}/${asset.id}/display.webp`,
    thumbnail = `${organizationId}/${asset.id}/thumb.webp`;
  await putObject(key, display);
  await putObject(thumbnail, thumb);
  await pool.query("select app_private.media_job($1,$2,$3::jsonb)", [
    eventId,
    organizationId,
    JSON.stringify({ key, thumbnail, width, height }),
  ]);
  return true;
}
