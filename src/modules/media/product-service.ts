import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";
import { dishMedia } from "@/db/schema";
import { getPool } from "@/db";
import { domainError } from "@/modules/organizations/service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { putObject, getObject } from "./storage";
export async function mediaCommand(
  actor: Actor,
  outletId: string,
  id: string,
  action: "reserve" | "queue" | "approve" | "unapprove",
  data: Record<string, unknown> = {}
) {
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: { id: string; status: string; sourceKey: string } }>(
            sql`select app_private.media_command(${outletId},${id},${action},${JSON.stringify(data)}::jsonb) as result`
          )
        ).rows[0]!.result
    );
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
  const budget = Number(process.env["MEDIA_OUTLET_BUDGET_BYTES"] ?? 104857600);
  if (!Number.isSafeInteger(budget) || budget < 5242880)
    throw new Error("Invalid media storage budget");
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
export async function publicMedia(id: string, thumbnail = false) {
  const read = async () =>
    (
      await getPool().query<{ data: { key: string; thumbnail: string } | null }>(
        "select app_private.public_dish_media($1) as data",
        [id]
      )
    ).rows[0]?.data;
  const a = await read();
  if (!a) throw new NotFoundError("Photo");
  const bytes = await getObject(thumbnail ? a.thumbnail : a.key);
  if (!(await read())) throw new NotFoundError("Photo");
  return bytes;
}
