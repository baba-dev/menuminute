import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";
import { dishMedia } from "@/db/schema";
import { getPool } from "@/db";
import { domainError } from "@/modules/organizations/service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { putObject, getObject } from "./storage";
import { env } from "@/lib/config/env";
import { createHash } from "node:crypto";
import { invalidateOutletMenuCache } from "@/modules/menu-product/cache";
import { mediaEnv } from "@/lib/config/media-env";
export async function mediaCommand(
  actor: Actor,
  outletId: string,
  id: string,
  action: "reserve" | "queue" | "approve" | "unapprove",
  data: Record<string, unknown> = {}
) {
  try {
    const result = await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: { id: string; status: string; sourceKey: string } }>(
            sql`select app_private.media_command(${outletId},${id},${action},${JSON.stringify(data)}::jsonb) as result`
          )
        ).rows[0]!.result
    );
    if (action === "approve" || action === "unapprove") {
      await invalidateOutletMenuCache(outletId);
    }
    return result;
  } catch (e) {
    domainError(e);
  }
}
export async function uploadDishPhoto(
  actor: Actor,
  outletId: string,
  bytes: Buffer,
  rights: string
) {
  if (!bytes.length || bytes.length > 5242880)
    throw new ValidationError("Choose an image up to 5 MiB");
  z.string().trim().min(5).max(500).parse(rights);
  const budget = env.MEDIA_OUTLET_BUDGET_BYTES;
  const id = crypto.randomUUID();
  const reserved = await mediaCommand(actor, outletId, id, "reserve", {
    sizeBytes: bytes.length,
    rights,
    budget,
  });
  await putObject(reserved.sourceKey, bytes);
  await mediaCommand(actor, outletId, id, "queue");
  return { id, status: "queued" };
}
export async function privateMedia(actor: Actor, outletId: string, id: string) {
  const read = () =>
    withOutlet(
      actor,
      outletId,
      "menu.write",
      async (tx) =>
        (
          await tx
            .select()
            .from(dishMedia)
            .where(and(eq(dishMedia.id, id), eq(dishMedia.outletId, outletId)))
        )[0]
    );
  const a = await read();
  if (!a || a.status !== "ready" || !a.derivativeKey) throw new NotFoundError("Processed photo");
  const bytes = await getObject(a.derivativeKey);
  const current = await read();
  if (!current || current.status !== "ready") throw new NotFoundError("Processed photo");
  return bytes;
}
function publicMediaReader(id: string) {
  return async () =>
    (
      await getPool().query<{ data: { key: string; thumbnail: string } | null }>(
        "select app_private.public_dish_media($1) as data",
        [id]
      )
    ).rows[0]?.data;
}

/** The storage key is controlled by PostgreSQL, not by the request URL. */
export function isPublicDerivativeKey(key: string): boolean {
  const parts = key.split("/");
  return (
    parts.length === 3 &&
    parts.slice(0, 2).every((part) => /^[A-Za-z0-9_-]+$/.test(part)) &&
    (parts[2] === "display.webp" || parts[2] === "thumb.webp")
  );
}

export async function publicMediaResponse(
  id: string,
  thumbnail = false,
  ifNoneMatch: string | null = null,
  allowInternalOffload = false
) {
  const read = publicMediaReader(id);
  const a = await read();
  if (!a) throw new NotFoundError("Photo");
  const key = thumbnail ? a.thumbnail : a.key;
  const etag = `"${createHash("sha256").update(key).digest("base64url")}"`;
  const validators = ifNoneMatch?.split(",").map((value) => value.trim().replace(/^W\//, ""));
  if (validators?.includes(etag) || validators?.includes("*")) {
    return { etag, notModified: true as const, bytes: Buffer.alloc(0), internalPath: null };
  }
  // The internal path is derived solely from an authorized database storage key,
  // never from the public request URL. Nginx's location must be marked internal.
  if (
    allowInternalOffload &&
    mediaEnv.MEDIA_STORAGE === "local" &&
    mediaEnv.MEDIA_X_ACCEL_REDIRECT_ENABLED &&
    isPublicDerivativeKey(key)
  ) {
    const current = await read();
    if (!current || (thumbnail ? current.thumbnail : current.key) !== key)
      throw new NotFoundError("Photo");
    return {
      etag,
      notModified: false as const,
      bytes: Buffer.alloc(0),
      internalPath: `/_menuminute_media_internal/${key}`,
    };
  }
  const bytes = await getObject(key);
  const current = await read();
  if (!current || (thumbnail ? current.thumbnail : current.key) !== key)
    throw new NotFoundError("Photo");
  return { bytes, etag, notModified: false as const, internalPath: null };
}

export async function publicMedia(id: string, thumbnail = false) {
  const result = await publicMediaResponse(id, thumbnail);
  if (result.notModified || !result.bytes) {
    throw new Error("Unexpected conditional media response");
  }
  return result.bytes;
}
