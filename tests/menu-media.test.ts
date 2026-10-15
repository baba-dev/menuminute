import { it, expect } from "vitest";
import sharp from "sharp";
import { fixture, admin } from "./helpers";
import { workerPool, claimEvents, consumeEvent } from "../src/modules/jobs/worker";
import {
  uploadDishPhoto,
  mediaCommand,
  publicMedia,
  privateMedia,
} from "../src/modules/media/product-service";
import { commandMenu } from "../src/modules/menu-product/service";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
async function processOrg(org: string) {
  const p = workerPool(process.env["WORKER_DATABASE_URL"]!);
  try {
    for (let n = 0; n < 10; n++) {
      const rows = await claimEvents(p, 50);
      if (!rows.length) break;
      for (const r of rows)
        await consumeEvent(
          p,
          {
            eventId: r.id,
            organizationId: r.organization_id,
            attempt: r.attempts,
            deliverySequence: r.delivery_sequence,
            schemaVersion: 1,
          },
          `${r.id}-${r.delivery_sequence}`
        );
    }
    expect(
      (
        await p.query(
          "select count(*)::int as n from outbox_events where organization_id=$1 and type='media.process' and status='completed'",
          [org]
        )
      ).rows[0].n
    ).toBeGreaterThan(0);
  } finally {
    await p.end();
  }
}
it("processes private originals, requires approval + publication, strips metadata, and immediately removes public access on unapproval", async () => {
  const f = await fixture();
  const bytes = await sharp({
    create: { width: 400, height: 300, channels: 3, background: "#ff8040" },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: "Private author" } } })
    .toBuffer();
  const asset = await uploadDishPhoto(
    f.actor,
    f.outlet.id,
    bytes,
    "Restaurant owned test photograph"
  );
  await expect(publicMedia(asset.id)).rejects.toMatchObject({ statusCode: 404 });
  await processOrg(f.outlet.organizationId);
  const privateBytes = await privateMedia(f.actor, f.outlet.id, asset.id);
  const meta = await sharp(privateBytes).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();
  const menuId = crypto.randomUUID();
  const doc = menuDocumentSchema.parse({
    name: "Photo menu",
    currency: "INR",
    categories: [
      {
        id: "photos",
        name: "Photos",
        items: [{ id: "photo-dish", name: "Photo dish", priceMinor: 1200, mediaId: asset.id }],
      },
    ],
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document: doc },
  });
  await expect(
    commandMenu(f.actor, f.outlet.id, menuId, {
      key: crypto.randomUUID(),
      expectedRevision: 1,
      action: "publish",
      data: {},
    })
  ).rejects.toMatchObject({ statusCode: 422 });
  await mediaCommand(f.actor, f.outlet.id, asset.id, "approve");
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  expect((await publicMedia(asset.id)).byteLength).toBeGreaterThan(0);
  await mediaCommand(f.actor, f.outlet.id, asset.id, "unapprove");
  await expect(publicMedia(asset.id)).rejects.toMatchObject({ statusCode: 404 });
});
it("rejects malformed/SVG content and revoked delegated authority without publishing bytes", async () => {
  const f = await fixture();
  const asset = await uploadDishPhoto(
    f.actor,
    f.outlet.id,
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    "Owned illustrative test file"
  );
  await processOrg(f.outlet.organizationId);
  await expect(privateMedia(f.actor, f.outlet.id, asset.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  const next = await uploadDishPhoto(
    f.actor,
    f.outlet.id,
    await sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } })
      .png()
      .toBuffer(),
    "Owned test file for revocation"
  );
  await admin(async (_, p) => {
    await p.query("update organization_members set is_active=false where user_id=$1", [
      f.actor.userId,
    ]);
  });
  await processOrg(f.outlet.organizationId);
  await admin(async (_, p) => {
    const row = (
      await p.query("select status,last_error,approved_at from dish_media where id=$1", [next.id])
    ).rows[0];
    expect(row.status).toBe("failed");
    expect(row.last_error).toBe("authority_revoked");
    expect(row.approved_at).toBeNull();
  });
});
