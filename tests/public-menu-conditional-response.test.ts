import { describe, expect, it } from "vitest";
import { etagMatches, publicMenuEtag } from "@/modules/menu-product/conditional-response";
import type { PublicProduct } from "@/modules/menu-product/service";

const sample: PublicProduct = {
  outlet: {
    id: "outlet",
    name: "Baba Bakery",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "dine_in",
    fulfillmentModes: ["dine_in"],
    isDemoData: false,
    versioned: true,
  },
  point: null,
  catalogFingerprint: "released-v1",
  now: "2026-11-01T12:00:05.000Z",
  menus: [],
};

describe("guest-menu conditional responses", () => {
  it("reuses the ETag within a minute but not across a schedule minute", () => {
    const etag = publicMenuEtag(sample);
    expect(publicMenuEtag({ ...sample, now: "2026-11-01T12:00:59.000Z" })).toBe(etag);
    expect(publicMenuEtag({ ...sample, now: "2026-11-01T12:01:00.000Z" })).not.toBe(etag);
  });
  it("revalidates any changed public menu, outlet state and availability", () => {
    const etag = publicMenuEtag(sample);
    expect(publicMenuEtag({ ...sample, catalogFingerprint: "released-v2" })).not.toBe(etag);
    expect(
      publicMenuEtag({ ...sample, outlet: { ...sample.outlet, orderingEnabled: true } })
    ).not.toBe(etag);
    expect(publicMenuEtag({ ...sample, conciergeEnabled: true })).not.toBe(etag);
  });
  it("accepts matching weak If-None-Match values and rejects unrelated values", () => {
    const etag = publicMenuEtag(sample);
    expect(etagMatches(`W/"old", ${etag}`, etag)).toBe(true);
    expect(etagMatches('W/"old"', etag)).toBe(false);
    expect(etagMatches(null, etag)).toBe(false);
  });
});
