import { afterAll, describe, expect, it, vi } from "vitest";

// Plan limits on, AI on, and a scripted provider: no real provider is ever called.
const state = vi.hoisted(() => ({
  actor: { userId: "" },
  outletId: "",
  infer: vi.fn(),
}));
vi.mock("@/lib/config/env", async (original) => {
  const mod = await original<typeof import("@/lib/config/env")>();
  return {
    ...mod,
    env: {
      ...mod.env,
      PLAN_LIMITS_ENFORCED: true,
      AI_FEATURES_ENABLED: true,
      AI_ORCHESTRATOR_ENABLED: true,
    },
  };
});
vi.mock("@/lib/request-context", async (original) => {
  const mod = await original<typeof import("@/lib/request-context")>();
  return {
    ...mod,
    requestContext: async () => ({ actor: state.actor, restaurant: { id: state.outletId } }),
  };
});
vi.mock("@/modules/menu-product/service", async (original) => {
  const mod = await original<typeof import("@/modules/menu-product/service")>();
  return {
    ...mod,
    listMenus: async () => [{ id: "menu-1" }],
    menuDetail: async () => ({
      canWrite: true,
      archived: false,
      document: { categories: [{ items: [{ id: "dish-1", name: "Paneer Curry" }] }] },
    }),
  };
});
vi.mock("@/modules/intelligence", async (original) => {
  const mod = await original<typeof import("@/modules/intelligence")>();
  return {
    ...mod,
    createProviderHub: () => ({
      available: () => [{ provider: "cloudflare", model: "test/model" }],
      infer: state.infer,
    }),
  };
});

import { admin, fixture } from "./helpers";
import { POST } from "../src/app/api/catalog/dish-autofill/route";
import { redisClient } from "../src/lib/redis";

type F = Awaited<ReturnType<typeof fixture>>;
const owner = <T>(text: string, params: unknown[] = []) =>
  admin(async (_db, pool) => (await pool.query(text, params)).rows as T[]);
const used = async (f: F) =>
  (
    await owner<{ used: number }>(
      "select coalesce(sum(used),0)::int as used from app_private.ai_credit_usage where organization_id=$1",
      [f.outlet.organizationId]
    )
  )[0]!.used;
const request = () =>
  new Request("http://localhost/api/catalog/dish-autofill", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: crypto.randomUUID(),
      menuId: "menu-1",
      dishId: "dish-1",
      provider: "cloudflare",
      name: "Paneer Curry",
      description: "",
      category: "Mains",
    }),
  });
const good = {
  finishReason: "stop",
  provider: "cloudflare",
  model: "test/model",
  toolCalls: [],
  content: JSON.stringify({
    description: "A creamy tomato curry with paneer.",
    dietary: ["vegetarian"],
    culinary: { spiceLevel: 2, flavorNotes: ["Aromatic"], servingTemp: "hot" },
    nutrition: {},
    safety: { ingredients: [], allergens: ["dairy"], crossContact: "" },
    pairingNames: [],
  }),
};
async function as(f: F) {
  state.actor = f.actor;
  state.outletId = f.outlet.id;
  // A fresh Redis rate-limit slate for this user, so the burst limits never interfere.
  const cache = await redisClient("cache");
  const keys = await cache.keys("ai:dish:*");
  if (keys.length) await cache.del(keys);
}
afterAll(() => state.infer.mockReset());

describe("dish autofill spends AI credits", () => {
  it("charges one credit for a successful suggestion", async () => {
    const f = await fixture();
    await as(f);
    state.infer.mockResolvedValueOnce(good);
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(await used(f)).toBe(1);
  });

  it("gives the credit back when the provider fails", async () => {
    const f = await fixture();
    await as(f);
    state.infer.mockRejectedValueOnce(new Error("provider down"));
    const res = await POST(request());
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(await used(f)).toBe(0);
  });

  it("refuses with AI_CREDITS_EXHAUSTED (402) once the allowance is used, without calling the provider", async () => {
    const f = await fixture();
    await as(f);
    await owner(
      "insert into app_private.ai_credit_usage(organization_id,month,used) values($1,(date_trunc('month',now() at time zone 'UTC'))::date,10)",
      [f.outlet.organizationId]
    );
    state.infer.mockClear();
    const res = await POST(request());
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ code: "AI_CREDITS_EXHAUSTED" });
    expect(state.infer).not.toHaveBeenCalled();
    expect(await used(f)).toBe(10);
  });
});
