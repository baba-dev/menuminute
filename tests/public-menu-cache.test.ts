import { expect, it } from "vitest";
import {
  getCachedPublicProduct,
  invalidateOutletMenuCache,
  invalidateOutletMenuCaches,
  revokeCachedQrToken,
  setCachedPublicProduct,
} from "../src/modules/menu-product/cache";
import type { PublicProduct } from "../src/modules/menu-product/service";

function menu(outletId: string): PublicProduct {
  return {
    outlet: {
      id: outletId,
      name: "Cache test",
      currency: "INR",
      timezone: "Asia/Kolkata",
      outletType: "restaurant",
      fulfillmentModes: ["dine_in"],
      isDemoData: false,
      versioned: true,
    },
    point: null,
    catalogFingerprint: "fingerprint",
    now: new Date(0).toISOString(),
    menus: [],
  };
}

it("only caches snapshots captured after an outlet generation was known", async () => {
  const token = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const data = menu(outletId);
  expect((await getCachedPublicProduct(token, null)).fence).toBeNull();
  await setCachedPublicProduct(token, null, data, null);
  const candidate = await getCachedPublicProduct(token, null);
  expect(candidate.data).toBeNull();
  expect(candidate.fence).toEqual({ outletId, version: "0" });
  await setCachedPublicProduct(token, null, data, candidate.fence);
  const hit = await getCachedPublicProduct(token, null);
  expect(hit.data?.outlet.id).toBe(outletId);
  expect(hit.data?.now).not.toBe(new Date(0).toISOString());
  await invalidateOutletMenuCache(outletId);
  expect((await getCachedPublicProduct(token, null)).data).toBeNull();
  // Simulate an in-flight read that completes AFTER a mutation.
  await setCachedPublicProduct(token, null, data, candidate.fence);
  expect((await getCachedPublicProduct(token, null)).data).toBeNull();
});

it("tombstones regenerated tokens against cached reads and in-flight population", async () => {
  const token = crypto.randomUUID();
  const outletId = crypto.randomUUID();
  const data = menu(outletId);
  await setCachedPublicProduct(token, null, data, null);
  const original = await getCachedPublicProduct(token, null);
  await setCachedPublicProduct(token, null, data, original.fence);
  expect((await getCachedPublicProduct(token, null)).data).not.toBeNull();
  await revokeCachedQrToken(outletId, token);
  expect((await getCachedPublicProduct(token, null)).data).toBeNull();
  await setCachedPublicProduct(token, null, data, original.fence);
  await setCachedPublicProduct(token, null, data, null);
  expect((await getCachedPublicProduct(token, null)).fence).toBeNull();
});

it("invalidates all assigned outlets while retaining independent locale keys", async () => {
  const a = crypto.randomUUID();
  const b = crypto.randomUUID();
  const ta = crypto.randomUUID();
  const tb = crypto.randomUUID();
  const da = menu(a);
  const db = menu(b);
  for (const [token, data] of [[ta, da], [tb, db]] as const) {
    await setCachedPublicProduct(token, null, data, null);
    const read = await getCachedPublicProduct(token, null);
    await setCachedPublicProduct(token, null, data, read.fence);
  }
  const current = await getCachedPublicProduct(ta, null);
  await setCachedPublicProduct(ta, "hi", da, current.fence);
  expect((await getCachedPublicProduct(ta, "hi")).data).not.toBeNull();
  await invalidateOutletMenuCaches([a, b, b]);
  expect((await getCachedPublicProduct(ta, null)).data).toBeNull();
  expect((await getCachedPublicProduct(ta, "hi")).data).toBeNull();
  expect((await getCachedPublicProduct(tb, null)).data).toBeNull();
});
