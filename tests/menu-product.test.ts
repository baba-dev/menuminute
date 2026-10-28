import { it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { fixture, admin } from "./helpers";
import {
  commandMenu,
  menuDetail,
  publicProduct,
  qrCommand,
  saveMenuTranslation,
} from "../src/modules/menu-product/service";
import { translationTemplate } from "../src/modules/menu-product/translations";
import { menuDocumentSchema, availableNow } from "../src/modules/menu-product/contracts";
import { projectMenu } from "../src/modules/menu-product/projector";
import { withActor } from "../src/modules/tenancy/service";
import { manageOrganization, listOrganizations } from "../src/modules/organizations/service";
const document = (currency = "INR") =>
  menuDocumentSchema.parse({
    name: "Lunch menu",
    currency,
    categories: [
      {
        id: "starters",
        name: "Starters",
        items: [
          {
            id: "dish-one",
            name: "Paneer plate",
            priceMinor: 12500,
            variants: [
              { id: "small", name: "Small", priceMinor: 12500 },
              { id: "large", name: "Large", priceMinor: 18000 },
            ],
            addOnGroups: [
              {
                id: "extras",
                name: "Extras",
                min: 0,
                max: 1,
                options: [{ id: "extra-one", name: "Extra bread", priceMinor: 1500 }],
              },
            ],
          },
        ],
      },
    ],
  });
async function create(f: Awaited<ReturnType<typeof fixture>>, doc = document(f.outlet.currency)) {
  const id = crypto.randomUUID();
  await commandMenu(f.actor, f.outlet.id, id, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document: doc },
  });
  return id;
}
async function command(
  f: Awaited<ReturnType<typeof fixture>>,
  id: string,
  action: string,
  data: Record<string, unknown> = {}
) {
  const m = await menuDetail(f.actor, id);
  return commandMenu(f.actor, f.outlet.id, id, {
    key: crypto.randomUUID(),
    expectedRevision: m.revision,
    action,
    data,
  });
}
it("keeps draft private, publishes immutable versions, retains QR through save/republish and excludes archived public data", async () => {
  const f = await fixture();
  const id = await create(f);
  expect(await publicProduct(f.outlet.publicId)).toBeNull();
  await command(f, id, "publish");
  const before = await publicProduct(f.outlet.publicId);
  expect(before?.menus[0]?.document.categories[0]?.items[0]?.name).toBe("Paneer plate");
  const doc = document();
  doc.categories[0]!.items[0]!.name = "Private new name";
  doc.categories[0]!.items.push({
    ...doc.categories[0]!.items[0]!,
    id: "archived-dish",
    name: "Secret archived dish",
    variants: [],
    addOnGroups: [],
    archived: true,
  });
  await command(f, id, "save", { document: doc });
  expect(
    (await publicProduct(f.outlet.publicId))?.menus[0]?.document.categories[0]?.items[0]?.name
  ).toBe("Paneer plate");
  await command(f, id, "publish");
  const current = await publicProduct(f.outlet.publicId);
  expect(current?.menus[0]?.document.categories[0]?.items[0]?.name).toBe("Private new name");
  expect(JSON.stringify(current)).not.toContain("Secret archived dish");
  await admin(async (_, p) => {
    const releases = await p.query(
      "select document from menu_releases where menu_id=$1 order by revision",
      [id]
    );
    expect(releases.rows).toHaveLength(2);
    expect(releases.rows[0].document.categories[0].items[0].name).toBe("Paneer plate");
  });
  await command(f, id, "unpublish");
  expect(await publicProduct(f.outlet.publicId)).toBeNull();
  await command(f, id, "publish");
  expect(await publicProduct(f.outlet.publicId)).not.toBeNull();
});
it("publishes only human-reviewed translations for the exact immutable source revision", async () => {
  const f = await fixture();
  const id = await create(f);
  await command(f, id, "publish");
  const source = document();
  const translated = translationTemplate(source);
  translated.name = "दोपहर का भोजन";
  translated.categories[0]!.name = "शुरुआत";
  translated.categories[0]!.items[0]!.name = "पनीर थाली";
  await saveMenuTranslation(f.actor, f.outlet.id, id, {
    key: crypto.randomUUID(),
    locale: "hi-in",
    sourceRevision: 2,
    expectedRevision: 0,
    reviewConfirmed: true,
    document: translated,
  });
  const localized = await publicProduct(f.outlet.publicId, "hi-IN");
  expect(localized?.locale).toBe("hi-IN");
  expect(localized?.availableLocales).toContain("hi-IN");
  expect(localized?.menus[0]?.document.categories[0]?.items[0]?.name).toBe("पनीर थाली");
  expect(localized?.menus[0]?.document.categories[0]?.items[0]?.priceMinor).toBe(12500);

  const next = document();
  next.categories[0]!.items[0]!.name = "Reviewed source revision";
  await command(f, id, "save", { document: next });
  // A draft does not make the reviewed translation stale for guests.
  expect(
    (await publicProduct(f.outlet.publicId, "hi-IN"))?.menus[0]?.document.categories[0]?.items[0]
      ?.name
  ).toBe("पनीर थाली");
  await command(f, id, "publish");
  const stale = await publicProduct(f.outlet.publicId, "hi-IN");
  expect(stale?.locale).toBeNull();
  expect(stale?.availableLocales).not.toContain("hi-IN");
  expect(stale?.menus[0]?.document.categories[0]?.items[0]?.name).toBe("Reviewed source revision");
});
it("reconciles identical creation keys, rejects stale writers and checks current permission on retries", async () => {
  const f = await fixture();
  const id = crypto.randomUUID(),
    key = crypto.randomUUID();
  const input = { key, expectedRevision: 0, action: "create", data: { document: document() } };
  const a = await commandMenu(f.actor, f.outlet.id, id, input);
  expect(
    await commandMenu(f.actor, f.outlet.id, id, {
      ...input,
      data: { document: { ...document(), name: "Later legacy snapshot" } },
    })
  ).toEqual(a);
  const updates = await Promise.allSettled(
    ["First update", "Second update"].map((name) =>
      commandMenu(f.actor, f.outlet.id, id, {
        key: crypto.randomUUID(),
        expectedRevision: 1,
        action: "save",
        data: { document: { ...document(), name } },
      })
    )
  );
  expect(updates.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  await admin(async (_, p) => {
    await p.query("update organization_members set is_active=false where user_id=$1", [
      f.actor.userId,
    ]);
  });
  await expect(commandMenu(f.actor, f.outlet.id, id, input)).rejects.toMatchObject({
    statusCode: 403,
  });
});
it("enforces organization/currency sharing, all-assignment edits, and outlet-local overrides", async () => {
  const f = await fixture();
  const foreign = await fixture();
  const id = await create(f);
  const org = f.outlet.organizationId;
  const version = (await listOrganizations(f.actor))[0]!.version;
  const other = await manageOrganization(f.actor, org, {
    key: crypto.randomUUID(),
    expectedVersion: version,
    command: {
      action: "outlet.create",
      data: {
        name: "Second kitchen",
        country: "IN",
        currency: "INR",
        timezone: "Asia/Kolkata",
        outletType: "takeout",
        fulfillmentModes: ["pickup"],
      },
    },
  });
  await command(f, id, "assign", { outletId: other.outletId, brandId: null, assigned: true });
  await expect(
    command(f, id, "assign", { outletId: foreign.outlet.id, brandId: null, assigned: true })
  ).rejects.toMatchObject({ statusCode: 403 });
  const uid = crypto.randomUUID();
  await admin(async (_, p) => {
    await p.query(
      "insert into users(id,email,name,email_verified) values($1,$2,'Scoped editor',true)",
      [uid, `${uid}@test.invalid`]
    );
    await p.query(
      "insert into organization_members(id,organization_id,user_id,role) values($1,$2,$3,'member')",
      [uid, org, uid]
    );
    await p.query(
      "insert into outlet_grants(organization_id,member_id,outlet_id,roles) values($1,$2,$3,ARRAY['menu_editor'])",
      [org, uid, other.outletId]
    );
  });
  const actor = { userId: uid };
  expect((await menuDetail(actor, id)).canWrite).toBe(false);
  await expect(
    commandMenu(actor, String(other.outletId), id, {
      key: crypto.randomUUID(),
      expectedRevision: (await menuDetail(actor, id)).revision,
      action: "save",
      data: { document: document() },
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    commandMenu(actor, String(other.outletId), id, {
      key: crypto.randomUUID(),
      expectedRevision: (await menuDetail(actor, id)).revision,
      action: "override",
      data: { outletId: other.outletId, dishId: "dish-one", priceMinor: 15000, soldOut: true },
    })
  ).rejects.toThrow("Variant prices cannot use a local base-price override");
  await commandMenu(actor, String(other.outletId), id, {
    key: crypto.randomUUID(),
    expectedRevision: (await menuDetail(actor, id)).revision,
    action: "override",
    data: { outletId: other.outletId, dishId: "dish-one", priceMinor: null, soldOut: true },
  });
  await command(f, id, "publish");
  const localToken = await admin(
    async (_, p) =>
      (
        await p.query("select destination_token from qr_codes where restaurant_id=$1", [
          other.outletId,
        ])
      ).rows[0].destination_token
  );
  const local = await publicProduct(localToken);
  expect(local?.menus[0]?.overrides[0]?.soldOut).toBe(true);
  expect((await publicProduct(f.outlet.publicId))?.menus[0]?.overrides).toEqual([]);
  // Warm the outlet-local Redis cache, then publish through the origin outlet.
  await publicProduct(localToken);
  const updated = document();
  updated.categories[0]!.items[0]!.name = "Shared menu refreshed";
  await command(f, id, "save", { document: updated });
  await command(f, id, "publish");
  expect((await publicProduct(localToken))?.menus[0]?.document.categories[0]?.items[0]?.name).toBe(
    "Shared menu refreshed"
  );
  await expect(
    withActor(f.actor, (tx) =>
      tx.execute(sql`update menus set published_revision=1 where id=${id}`)
    )
  ).rejects.toThrow();
});
it("requires clearing local base prices before introducing shared variants", async () => {
  const f = await fixture();
  const doc = document();
  doc.categories[0]!.items[0]!.variants = [];
  const id = await create(f, doc);
  await command(f, id, "override", {
    outletId: f.outlet.id,
    dishId: "dish-one",
    priceMinor: 14000,
    soldOut: null,
  });
  await expect(command(f, id, "save", { document: document() })).rejects.toThrow(
    "Clear local base-price overrides before adding variants"
  );
  await command(f, id, "override", {
    outletId: f.outlet.id,
    dishId: "dish-one",
    priceMinor: null,
    soldOut: null,
  });
  await command(f, id, "save", { document: document() });
  expect((await menuDetail(f.actor, id)).document.categories[0]!.items[0]!.variants).toHaveLength(
    2
  );
});
it("creates service-point QR, preserves identity and explicitly revokes/regenerates old tokens", async () => {
  const f = await fixture();
  const id = await create(f);
  await command(f, id, "publish");
  const created = await qrCommand(f.actor, f.outlet.id, {
    key: crypto.randomUUID(),
    action: "create",
    data: { label: "Patio menu", pointLabel: "Table 4" },
  });
  expect((await publicProduct(created.token!))?.point).toBe("Table 4");
  const replacement = await qrCommand(f.actor, f.outlet.id, {
    key: crypto.randomUUID(),
    action: "regenerate",
    data: { qrId: created.id },
  });
  expect(await publicProduct(created.token!)).toBeNull();
  expect((await publicProduct(replacement.token!))?.point).toBe("Table 4");
  await qrCommand(f.actor, f.outlet.id, {
    key: crypto.randomUUID(),
    action: "revoke",
    data: { qrId: replacement.id },
  });
  expect(await publicProduct(replacement.token!)).toBeNull();
  expect(await publicProduct(f.outlet.publicId)).not.toBeNull();
});
it("validates flat options, prices, duplicate IDs, weekly overnight/date exceptions and DST instants", () => {
  const doc = document();
  doc.categories[0]!.items[0]!.addOnGroups[0]!.min = 2;
  expect(menuDocumentSchema.safeParse(doc).success).toBe(false);
  const unavailable = document();
  const item = unavailable.categories[0]!.items[0]!;
  item.addOnGroups[0]!.min = 1;
  item.addOnGroups[0]!.options[0]!.isAvailable = false;
  expect(menuDocumentSchema.safeParse(unavailable).success).toBe(true);
  expect(
    projectMenu(unavailable, "Asia/Kolkata", new Date(), []).categories[0]!.items[0]!.soldOut
  ).toBe(true);
  item.addOnGroups[0]!.min = 0;
  item.variants.forEach((v) => {
    v.isAvailable = false;
  });
  expect(
    projectMenu(unavailable, "Asia/Kolkata", new Date(), []).categories[0]!.items[0]!.soldOut
  ).toBe(true);
  const schedule = {
    weekly: [{ day: 1, start: "18:00", end: "02:00", allDay: false }],
    exceptions: [],
  };
  expect(availableNow(schedule, "Asia/Kolkata", new Date("2026-10-20T19:30:00+05:30"))).toBe(false);
  expect(availableNow(schedule, "Asia/Kolkata", new Date("2026-10-20T01:59:00+05:30"))).toBe(true);
  expect(availableNow(schedule, "Asia/Kolkata", new Date("2026-10-20T02:00:00+05:30"))).toBe(false);
  expect(
    availableNow(
      { ...schedule, exceptions: [{ date: "2026-10-20", closed: true, windows: [] }] },
      "Asia/Kolkata",
      new Date("2026-10-20T01:00:00+05:30")
    )
  ).toBe(false);
  const dst = { weekly: [{ day: 0, start: "01:00", end: "02:00", allDay: false }], exceptions: [] };
  expect(availableNow(dst, "America/New_York", new Date("2026-11-01T05:30:00Z"))).toBe(true);
  expect(availableNow(dst, "America/New_York", new Date("2026-11-01T06:30:00Z"))).toBe(true);
});

it("archives a published menu without destroying its release, blocks foreign deletion, and restores as private", async () => {
  const f = await fixture();
  const stranger = await fixture();
  const id = await create(f);
  await command(f, id, "publish");
  expect((await menuDetail(f.actor, id)).everPublished).toBe(true);
  const revision = (await menuDetail(f.actor, id)).revision;
  await expect(
    commandMenu(stranger.actor, stranger.outlet.id, id, {
      key: crypto.randomUUID(),
      expectedRevision: revision,
      action: "archive",
      data: {},
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  await command(f, id, "archive");
  const archived = await menuDetail(f.actor, id);
  expect(archived.archived).toBe(true);
  expect(archived.publishedRevision).toBeNull();
  expect(archived.everPublished).toBe(true);
  expect(await publicProduct(f.outlet.publicId)).toBeNull();
  await admin(async (_, pool) => {
    const result = await pool.query(
      "select count(*)::int as count from menu_releases where menu_id=$1",
      [id]
    );
    expect(result.rows[0].count).toBe(1);
  });
  await command(f, id, "restore");
  const restored = await menuDetail(f.actor, id);
  expect(restored.archived).toBe(false);
  expect(restored.publishedRevision).toBeNull();
  expect(restored.document.name).toBe("Lunch menu");
  expect(await publicProduct(f.outlet.publicId)).toBeNull();
  await command(f, id, "publish");
  expect((await publicProduct(f.outlet.publicId))?.menus[0]?.document.name).toBe("Lunch menu");
});

it("rejects cached menus when PostgreSQL says the organization has become inactive", async () => {
  const f = await fixture();
  const id = await create(f);
  await command(f, id, "publish");
  // First request teaches the token-outlet association; second fills Redis.
  await publicProduct(f.outlet.publicId);
  expect(await publicProduct(f.outlet.publicId)).not.toBeNull();
  await admin(async (_, pool) => {
    await pool.query("update organizations set is_active=false where id=$1", [
      f.outlet.organizationId,
    ]);
  });
  // This intentionally bypasses application invalidation: the SQL gate must still deny.
  expect(await publicProduct(f.outlet.publicId)).toBeNull();
});
