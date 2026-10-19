import { expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { admin, fixture } from "./helpers";
import {
  createImport,
  listImports,
  importDetail,
  addImportSource,
  readImportSource,
  cancelImport,
} from "../src/modules/menu-import/service";
import { parseImportCandidate } from "../src/modules/menu-import/contracts";
import {
  getPrivateSource,
  putPrivateSource,
  normalizeSource,
} from "../src/modules/menu-import/storage";

it("keeps AI candidates distinct from canonical menus and rejects invented required prices", () => {
  const id = crypto.randomUUID();
  expect(
    parseImportCandidate({
      schemaVersion: 1,
      importId: id,
      currency: "INR",
      categories: [
        {
          id: crypto.randomUUID(),
          name: { value: "Starters", evidence: [] },
          items: [
            {
              id: crypto.randomUUID(),
              name: { value: "Paneer", evidence: [] },
              priceMinor: { value: null, review: "needs_attention", evidence: [] },
              variants: [],
            },
          ],
        },
      ],
    }).categories[0]?.items[0]?.priceMinor.value
  ).toBeNull();
  expect(() =>
    parseImportCandidate({
      schemaVersion: 1,
      importId: id,
      currency: "INR",
      categories: [
        {
          id,
          name: { value: "Test", evidence: [] },
          items: [
            {
              id,
              name: { value: "Dup", evidence: [] },
              priceMinor: { value: -1, evidence: [] },
            },
          ],
        },
      ],
    })
  ).toThrow();
});
it("creates scoped durable sessions, handles retries, rejects cross-tenant reads and cancels safely", async () => {
  const f = await fixture(),
    foreign = await fixture();
  const id = crypto.randomUUID(),
    key = crypto.randomUUID();
  const first = await createImport(f.actor, f.outlet.id, { id, key });
  expect(first).toMatchObject({ id, status: "collecting", revision: 1 });
  expect(await createImport(f.actor, f.outlet.id, { id, key })).toMatchObject({
    id,
    duplicate: true,
  });
  await expect(
    createImport(f.actor, f.outlet.id, { id: crypto.randomUUID(), key })
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(await listImports(f.actor, f.outlet.id)).toEqual(
    expect.arrayContaining([expect.objectContaining({ id })])
  );
  expect((await importDetail(f.actor, f.outlet.id, id)).sources).toEqual([]);
  await expect(importDetail(foreign.actor, foreign.outlet.id, id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    cancelImport(foreign.actor, foreign.outlet.id, id, { expectedRevision: 1 })
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    cancelImport(f.actor, f.outlet.id, id, { expectedRevision: 10 })
  ).rejects.toMatchObject({ statusCode: 409 });
  expect(await cancelImport(f.actor, f.outlet.id, id, { expectedRevision: 1 })).toMatchObject({
    status: "cancelled",
    revision: 2,
  });
  expect(await cancelImport(f.actor, f.outlet.id, id, { expectedRevision: 1 })).toMatchObject({
    duplicate: true,
  });
  await admin(async (_db, pool) => {
    const rows = await pool.query(
      "select * from domain_audit where action like 'menu_import.%' and details->>'importId'=$1",
      [id]
    );
    expect(rows.rowCount).toBe(2);
    expect(
      (await pool.query("select * from menu_import_candidates where import_id=$1", [id])).rowCount
    ).toBe(0);
  });
});
it("normalizes private sources, replays same upload, rejects source-key conflicts and preserves published state", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "menu-import-test-"));
  const umask = process.umask(0o007);
  vi.stubEnv("MEDIA_ROOT", base);
  vi.stubEnv("MEDIA_STORAGE", "local");
  try {
    await fs.chmod(base, 0o2770);
    const f = await fixture();
    const id = crypto.randomUUID(),
      sourceId = crypto.randomUUID();
    await createImport(f.actor, f.outlet.id, { id, key: crypto.randomUUID() });
    const jpg = await sharp({
      create: { width: 140, height: 80, channels: 3, background: "white" },
    })
      .jpeg()
      .toBuffer();
    const initial = await addImportSource(
      f.actor,
      f.outlet.id,
      id,
      { id: sourceId, pageIndex: 0 },
      jpg
    );
    expect(initial).toMatchObject({ id: sourceId, status: "ready", duplicate: false });
    expect(
      await addImportSource(f.actor, f.outlet.id, id, { id: sourceId, pageIndex: 0 }, jpg)
    ).toMatchObject({ duplicate: true });
    const bytes = await readImportSource(f.actor, f.outlet.id, id, sourceId);
    expect((await sharp(bytes).metadata()).format).toBe("webp");
    const detail = await importDetail(f.actor, f.outlet.id, id);
    expect(detail.sources).toEqual([
      expect.objectContaining({ id: sourceId, width: 140, height: 80 }),
    ]);
    expect(JSON.stringify(detail)).not.toContain("storageKey");
    const other = await sharp({
      create: { width: 90, height: 80, channels: 3, background: "black" },
    })
      .jpeg()
      .toBuffer();
    await expect(
      addImportSource(f.actor, f.outlet.id, id, { id: sourceId, pageIndex: 0 }, other)
    ).rejects.toMatchObject({ statusCode: 409 });
    const foreign = await fixture();
    await expect(
      readImportSource(foreign.actor, foreign.outlet.id, id, sourceId)
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      addImportSource(f.actor, f.outlet.id, id, { id: crypto.randomUUID(), pageIndex: 0 }, jpg)
    ).rejects.toMatchObject({ statusCode: 409 });
    const storageRow = await admin(
      async (_db, pool) =>
        (await pool.query("select storage_key from menu_import_sources where id=$1", [sourceId]))
          .rows[0]
    );
    expect(await getPrivateSource(storageRow.storage_key)).toEqual(bytes);
    expect(
      (await fs.stat(path.dirname(path.join(base, storageRow.storage_key)))).mode & 0o7777
    ).toBe(0o2770);
    await cancelImport(f.actor, f.outlet.id, id, { expectedRevision: 2 });
    await expect(
      addImportSource(f.actor, f.outlet.id, id, { id: crypto.randomUUID(), pageIndex: 1 }, jpg)
    ).rejects.toMatchObject({ statusCode: 403 });
    const ownReleases = await admin(async (_db, pool) =>
      pool.query("select id from menu_releases where published_by=$1", [f.actor.userId])
    );
    expect(ownReleases.rowCount).toBe(0);
  } finally {
    process.umask(umask);
    vi.unstubAllEnvs();
    await fs.rm(base, { recursive: true, force: true });
  }
});
it("denies upload/read after role revocation and forbids unsafe input and storage traversal", async () => {
  const f = await fixture(),
    id = crypto.randomUUID();
  await createImport(f.actor, f.outlet.id, { id, key: crypto.randomUUID() });
  const png = await sharp({ create: { width: 24, height: 24, channels: 3, background: "white" } })
    .png()
    .toBuffer();
  await expect(normalizeSource(Buffer.from("<svg/>"))).rejects.toThrow();
  await expect(putPrivateSource("../escape.webp", Buffer.from("a"))).rejects.toThrow("key");
  await admin(async (_db, pool) => {
    await pool.query("update organization_members set is_active=false where user_id=$1", [
      f.actor.userId,
    ]);
  });
  await expect(listImports(f.actor, f.outlet.id)).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    addImportSource(f.actor, f.outlet.id, id, { id: crypto.randomUUID(), pageIndex: 0 }, png)
  ).rejects.toMatchObject({ statusCode: 403 });
});
