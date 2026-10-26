import { it, expect } from "vitest";
import sharp from "sharp";
import { fixture, admin } from "./helpers";
import { workerPool, claimEvents, consumeEvent } from "../src/modules/jobs/worker";
import {
  uploadDishPhoto,
  mediaCommand,
  publicMedia,
  privateMedia,
  publicMediaResponse,
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
  const response = await publicMediaResponse(asset.id);
  expect(response.notModified).toBe(false);
  if (response.notModified) throw new Error("Expected media bytes");
  expect(response.bytes.byteLength).toBeGreaterThan(0);
  expect((await publicMediaResponse(asset.id, false, response.etag)).notModified).toBe(true);
  await mediaCommand(f.actor, f.outlet.id, asset.id, "unapprove");
  await expect(publicMediaResponse(asset.id, false, response.etag)).rejects.toMatchObject({
    statusCode: 404,
  });
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
it("rechecks private photo scope after object retrieval and never serves another outlet through the selector", async () => {
  const f = await fixture();
  const other = await fixture();
  const asset = await uploadDishPhoto(
    other.actor,
    other.outlet.id,
    await sharp({ create: { width: 10, height: 10, channels: 3, background: "blue" } })
      .png()
      .toBuffer(),
    "Owned race test photograph"
  );
  await processOrg(other.outlet.organizationId);
  await admin(async (_, p) => {
    await p.query(
      "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'admin')",
      [crypto.randomUUID(), other.outlet.organizationId, f.actor.userId]
    );
  });
  await expect(privateMedia(f.actor, f.outlet.id, asset.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  const storage = await import("../src/modules/media/storage");
  const { vi } = await import("vitest");
  const original = storage.getObject;
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>((r) => (entered = r)),
    gate = new Promise<void>((r) => (release = r));
  const spy = vi.spyOn(storage, "getObject").mockImplementation(async (key) => {
    const bytes = await original(key);
    entered();
    await gate;
    return bytes;
  });
  try {
    const reading = privateMedia(f.actor, other.outlet.id, asset.id).then(
      () => null,
      (e) => e
    );
    await started;
    await admin(async (_, p) => {
      await p.query(
        "update organization_members set is_active=false where organization_id=$1 and user_id=$2",
        [other.outlet.organizationId, f.actor.userId]
      );
    });
    release();
    expect(await reading).toMatchObject({ statusCode: 403 });
  } finally {
    release();
    spy.mockRestore();
  }
});
