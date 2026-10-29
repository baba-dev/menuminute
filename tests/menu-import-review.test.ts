import { expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { createImport, importDetail } from "../src/modules/menu-import/service";
import {
  saveReview,
  applyReview,
  initialReviewDocument,
  assertReviewStructure,
} from "../src/modules/menu-import/review";
import { parseImportCandidate } from "../src/modules/menu-import/contracts";
import { commandMenu, menuDetail } from "../src/modules/menu-product/service";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";

async function seedReview(
  targetMenuId: string | null = null,
  existing?: Awaited<ReturnType<typeof fixture>>
) {
  const f = existing ?? (await fixture()),
    id = crypto.randomUUID(),
    sourceId = crypto.randomUUID();
  await createImport(f.actor, f.outlet.id, { id, key: crypto.randomUUID(), targetMenuId });
  const candidate = parseImportCandidate({
    schemaVersion: 1,
    importId: id,
    currency: f.outlet.currency,
    categories: [
      {
        id: crypto.randomUUID(),
        name: { value: "Starters", evidence: [{ sourceId, excerpt: "Starters" }] },
        items: [
          {
            id: crypto.randomUUID(),
            name: { value: "Curry", evidence: [{ sourceId, excerpt: "Curry" }] },
            priceMinor: {
              value: null,
              review: "needs_attention",
              evidence: [{ sourceId, excerpt: "blurred" }],
            },
            variants: [],
          },
        ],
      },
    ],
  });
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into menu_import_sources(id,import_id,organization_id,outlet_id,page_index,status,request_sha256,request_bytes,stored_sha256,stored_bytes,width,height,storage_key) values($1,$2,$3,$4,0,'ready',$5,100,$6,90,10,10,$7)",
      [
        sourceId,
        id,
        f.outlet.organizationId,
        f.outlet.id,
        "a".repeat(64),
        "b".repeat(64),
        "imports/" + f.outlet.organizationId + "/" + id + "/" + sourceId + ".webp",
      ]
    );
    await pool.query("update menu_imports set status='needs_review',revision=2 where id=$1", [id]);
    await pool.query(
      "insert into menu_import_candidates(import_id,organization_id,outlet_id,revision,schema_version,document) values($1,$2,$3,2,1,$4::jsonb)",
      [id, f.outlet.organizationId, f.outlet.id, JSON.stringify(candidate)]
    );
  });
  const doc = initialReviewDocument(candidate);
  doc.categories[0]!.items[0]!.priceMinor = 1250;
  const ids = candidate.categories.flatMap((c) => [c.id, ...c.items.map((i) => i.id)]);
  return { ...f, id, sourceId, candidate, doc, ids };
}
it("keeps immutable evidence and rejects structurally invented review entries", async () => {
  const f = await seedReview();
  const invented = structuredClone(f.doc);
  invented.categories[0]!.items.push({
    ...invented.categories[0]!.items[0]!,
    id: crypto.randomUUID(),
  });
  expect(() => assertReviewStructure(f.candidate, invented, f.ids, true)).toThrow();
  expect(f.candidate.categories[0]!.items[0]!.priceMinor.value).toBeNull();
  expect(() => assertReviewStructure(f.candidate, f.doc, [f.ids[0]!], true)).toThrow();
});
it("requires explicit server-side acknowledgement before finalizing a partial extraction", async () => {
  const f = await seedReview();
  await admin(async (_db, pool) => {
    await pool.query(
      "update menu_import_candidates set document=jsonb_set(document,'{sourceWarnings}',$2::jsonb) where import_id=$1",
      [f.id, JSON.stringify([{ sourceId: f.sourceId, reason: "invalid_provider_response" }])]
    );
  });
  const input = {
    expectedRevision: 2,
    candidateRevision: 2,
    document: f.doc,
    confirmedIds: f.ids,
    finalize: true,
  };
  await expect(saveReview(f.actor, f.outlet.id, f.id, input)).rejects.toMatchObject({
    statusCode: 422,
  });
  const ready = await saveReview(f.actor, f.outlet.id, f.id, {
    ...input,
    acknowledgePartial: true,
  });
  expect(ready.status).toBe("ready");
});
it("saves partial corrections, rejects stale revisions, confirms every ID, and applies a private new menu only once", async () => {
  const f = await seedReview(),
    foreign = await fixture();
  await expect(importDetail(foreign.actor, foreign.outlet.id, f.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    saveReview(foreign.actor, foreign.outlet.id, f.id, {
      expectedRevision: 2,
      candidateRevision: 2,
      document: f.doc,
      confirmedIds: f.ids,
      finalize: true,
    })
  ).rejects.toMatchObject({ statusCode: 404 });
  const partial = await saveReview(f.actor, f.outlet.id, f.id, {
    expectedRevision: 2,
    candidateRevision: 2,
    document: f.doc,
    confirmedIds: [f.ids[0]!],
    finalize: false,
  });
  expect(partial).toMatchObject({ status: "needs_review", revision: 3 });
  await expect(
    saveReview(f.actor, f.outlet.id, f.id, {
      expectedRevision: 2,
      candidateRevision: 2,
      document: f.doc,
      confirmedIds: f.ids,
      finalize: true,
    })
  ).rejects.toMatchObject({ statusCode: 409 });
  await expect(
    saveReview(f.actor, f.outlet.id, f.id, {
      expectedRevision: 3,
      candidateRevision: 2,
      document: f.doc,
      confirmedIds: [f.ids[0]!],
      finalize: true,
    })
  ).rejects.toMatchObject({ statusCode: 422 });
  const ready = await saveReview(f.actor, f.outlet.id, f.id, {
    expectedRevision: 3,
    candidateRevision: 2,
    document: f.doc,
    confirmedIds: f.ids,
    finalize: true,
  });
  expect(ready).toMatchObject({ status: "ready", revision: 4 });
  const menuId = crypto.randomUUID();
  const first = await applyReview(f.actor, f.outlet.id, f.id, {
    expectedRevision: 4,
    menuId,
    expectedMenuRevision: 0,
  });
  expect(first).toMatchObject({ status: "applied", menuId, menuRevision: 1, duplicate: false });
  expect(
    await applyReview(f.actor, f.outlet.id, f.id, {
      expectedRevision: 4,
      menuId,
      expectedMenuRevision: 0,
    })
  ).toMatchObject({ duplicate: true });
  await expect(
    applyReview(f.actor, f.outlet.id, f.id, {
      expectedRevision: 4,
      menuId: crypto.randomUUID(),
      expectedMenuRevision: 0,
    })
  ).rejects.toMatchObject({ statusCode: 409 });
  const menu = await menuDetail(f.actor, menuId);
  expect(menu.document.categories[0]?.items[0]?.priceMinor).toBe(1250);
  expect(menu.publishedRevision).toBeNull();
  const detail = await importDetail(f.actor, f.outlet.id, f.id);
  expect(detail.candidate?.document).toMatchObject({ schemaVersion: 1, importId: f.id });
  expect(detail.review).toMatchObject({ state: "applied", appliedMenuId: menuId });
  const counts = await admin(async (_db, pool) => ({
    release: (
      await pool.query("select count(*)::int AS n from menu_releases where menu_id=$1", [menuId])
    ).rows[0].n,
    audit: (
      await pool.query(
        "select count(*)::int AS n from domain_audit where action='menu_import.draft_applied' and details->>'importId'=$1",
        [f.id]
      )
    ).rows[0].n,
  }));
  expect(counts).toEqual({ release: 0, audit: 1 });
});
it("target application respects exact menu revision and never modifies a published release", async () => {
  const f = await fixture(),
    menuId = crypto.randomUUID();
  const old = menuDocumentSchema.parse({
    name: "Published",
    currency: f.outlet.currency,
    categories: [
      {
        id: "existing",
        name: "Known",
        items: [{ id: "dish", name: "Live dish", priceMinor: 200 }],
      },
    ],
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 0,
    action: "create",
    data: { document: old },
  });
  await commandMenu(f.actor, f.outlet.id, menuId, {
    key: crypto.randomUUID(),
    expectedRevision: 1,
    action: "publish",
    data: {},
  });
  const f2 = await seedReview(menuId, f);
  await saveReview(f2.actor, f2.outlet.id, f2.id, {
    expectedRevision: 2,
    candidateRevision: 2,
    document: f2.doc,
    confirmedIds: f2.ids,
    finalize: true,
  });
  await expect(
    applyReview(f2.actor, f2.outlet.id, f2.id, {
      expectedRevision: 3,
      menuId: crypto.randomUUID(),
      expectedMenuRevision: 2,
    })
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    applyReview(f2.actor, f2.outlet.id, f2.id, {
      expectedRevision: 3,
      menuId,
      expectedMenuRevision: 1,
    })
  ).rejects.toMatchObject({ statusCode: 409 });
  const applied = await applyReview(f2.actor, f2.outlet.id, f2.id, {
    expectedRevision: 3,
    menuId,
    expectedMenuRevision: 2,
  });
  expect(applied).toMatchObject({ status: "applied", menuId, menuRevision: 3 });
  const snapshot = await menuDetail(f2.actor, menuId);
  expect(snapshot.publishedRevision).toBe(2);
  expect(snapshot.document.categories[0]?.items[0]?.name).toBe("Curry");
  const live = await admin(
    async (_db, pool) =>
      (
        await pool.query("select document from menu_releases where menu_id=$1 and revision=2", [
          menuId,
        ])
      ).rows[0].document
  );
  expect(live.categories[0].items[0].name).toBe("Live dish");
});
