import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { admin, fixture } from "./helpers";

const mocks = vi.hoisted(() => ({
  session: null as null | { userId: string },
  reserveSource: vi.fn(),
  reserveToken: vi.fn(),
  verifiedOrderSource: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: async () =>
    mocks.session
      ? { user: { id: mocks.session.userId, emailVerified: true }, session: { id: "test-session" } }
      : null,
}));
vi.mock("@/modules/orders/rate-limit", () => ({
  verifiedOrderSource: mocks.verifiedOrderSource,
}));
vi.mock("@/modules/tiffin/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/tiffin/rate-limit")>();
  return {
    ...actual,
    reserveTiffinPublicSource: mocks.reserveSource,
    reserveTiffinPublicToken: mocks.reserveToken,
  };
});

import { env } from "../src/lib/config/env";
import { GET as menuGET, PUT as menuPUT } from "../src/app/api/tiffin/[outletId]/menu/route";
import {
  POST as comboPOST,
  PATCH as comboPATCH,
} from "../src/app/api/tiffin/[outletId]/combos/route";
import { GET as weekGET } from "../src/app/api/public-tiffin/[publicMenuId]/week/route";
import { POST as quotePOST } from "../src/app/api/public-tiffin/[publicMenuId]/quote/route";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
afterAll(() => pool.end());

const origin = new URL(env.APP_URL).origin;
beforeEach(() => {
  vi.stubEnv("TIFFIN_ENABLED", "true");
  mocks.session = null;
  mocks.reserveSource.mockReset().mockResolvedValue(true);
  mocks.reserveToken.mockReset().mockResolvedValue(true);
  mocks.verifiedOrderSource.mockReset().mockReturnValue("203.0.113.10");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function tiffinOutlet() {
  const f = await fixture("INR");
  await admin(async (_db, p) => {
    await p.query(
      "update restaurants set outlet_type='tiffin',is_published=true,timezone='Asia/Kolkata' where id=$1",
      [f.outlet.id]
    );
  });
  return { userId: f.actor.userId, outletId: f.outlet.id, token: f.outlet.publicId };
}

const ctx = <K extends string>(key: K, value: string) => ({
  params: Promise.resolve({ [key]: value } as Record<K, string>),
});
const dash = (path: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}${path}`, {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const pub = (token: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/public-tiffin/${token}/quote`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const week = (token: string, qs = "") =>
  new Request(`${origin}/api/public-tiffin/${token}/week${qs}`);
const slot = {
  kind: "lunch",
  startMinute: 720,
  endMinute: 840,
  cutoffMinutesBefore: 120,
  capacity: null,
};
const combo = {
  name: "Veg Thali",
  priceMinor: 12000,
  items: [{ label: "Roti", quantity: 4 }],
  addons: [{ label: "Extra roti", priceMinor: 1000 }],
};

async function seeded() {
  const o = await tiffinOutlet();
  mocks.session = { userId: o.userId };
  const m = ctx("outletId", o.outletId);
  const path = `/api/tiffin/${o.outletId}`;
  expect((await menuPUT(dash(`${path}/menu`, "PUT", { kind: "slot", slot }), m)).status).toBe(200);
  const created = await (await comboPOST(dash(`${path}/combos`, "POST", combo), m)).json();
  for (let weekday = 0; weekday < 7; weekday++)
    await menuPUT(
      dash(`${path}/menu`, "PUT", {
        kind: "week",
        week: { slotKind: "lunch", weekday, comboIds: [created.id] },
      }),
      m
    );
  mocks.session = null;
  return { ...o, m, path, combo: created };
}

describe("tiffin dashboard routes", () => {
  it("require a session (401) and, with the flag off, are a plain 404 even unauthenticated", async () => {
    const o = await tiffinOutlet();
    const m = ctx("outletId", o.outletId);
    const path = `/api/tiffin/${o.outletId}`;
    expect((await menuGET(dash(`${path}/menu`, "GET"), m)).status).toBe(401);
    expect((await menuPUT(dash(`${path}/menu`, "PUT", { kind: "slot", slot }), m)).status).toBe(
      401
    );
    expect((await comboPOST(dash(`${path}/combos`, "POST", combo), m)).status).toBe(401);
    expect((await comboPATCH(dash(`${path}/combos`, "PATCH", {}), m)).status).toBe(401);

    vi.stubEnv("TIFFIN_ENABLED", "false");
    const bodies: string[] = [];
    for (const res of [
      await menuGET(dash(`${path}/menu`, "GET"), m),
      await menuPUT(dash(`${path}/menu`, "PUT", { kind: "slot", slot }), m),
      await comboPOST(dash(`${path}/combos`, "POST", combo), m),
      await comboPATCH(dash(`${path}/combos`, "PATCH", {}), m),
    ]) {
      expect(res.status).toBe(404);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("rejects mutations from another origin or without JSON (403)", async () => {
    const o = await tiffinOutlet();
    mocks.session = { userId: o.userId };
    const m = ctx("outletId", o.outletId);
    const path = `/api/tiffin/${o.outletId}`;
    const evil = dash(`${path}/combos`, "POST", combo, { origin: "https://evil.invalid" });
    expect((await comboPOST(evil, m)).status).toBe(403);
    const text = dash(
      `${path}/menu`,
      "PUT",
      { kind: "slot", slot },
      { "content-type": "text/plain" }
    );
    expect((await menuPUT(text, m)).status).toBe(403);
  });

  it("reads and writes the menu end to end with the documented shapes", async () => {
    const o = await tiffinOutlet();
    mocks.session = { userId: o.userId };
    const m = ctx("outletId", o.outletId);
    const path = `/api/tiffin/${o.outletId}`;
    const put = (body: unknown) => menuPUT(dash(`${path}/menu`, "PUT", body), m);

    const s = await put({ kind: "slot", slot });
    expect(s.status).toBe(200);
    expect(await s.json()).toMatchObject({ kind: "lunch", startMinute: 720, enabled: true });

    const c = await comboPOST(dash(`${path}/combos`, "POST", combo), m);
    expect(c.status).toBe(200);
    const saved = await c.json();
    expect(saved).toMatchObject({ name: "Veg Thali", priceMinor: 12000, archived: false });

    const w = await put({
      kind: "week",
      week: { slotKind: "lunch", weekday: 1, comboIds: [saved.id] },
    });
    expect(await w.json()).toEqual({ slotKind: "lunch", weekday: 1, comboIds: [saved.id] });

    const read = await menuGET(dash(`${path}/menu`, "GET"), m);
    expect(read.status).toBe(200);
    const menu = await read.json();
    const day = menu.outlet.today as string;
    expect(menu.combos).toHaveLength(1);

    const ov = await put({
      kind: "override",
      override: { slotKind: "lunch", localDate: day, closed: true, comboIds: [] },
    });
    expect(await ov.json()).toMatchObject({ slotKind: "lunch", localDate: day, closed: true });
    const cleared = await put({
      kind: "overrideClear",
      override: { slotKind: "lunch", localDate: day, clear: true },
    });
    expect(await cleared.json()).toEqual({ slotKind: "lunch", localDate: day, cleared: true });

    const archived = await comboPATCH(
      dash(`${path}/combos`, "PATCH", { id: saved.id, archived: true }),
      m
    );
    expect(archived.status).toBe(200);
    expect(await archived.json()).toMatchObject({ id: saved.id, archived: true });
  });

  it("rejects an unknown kind or extra keys with a validation error", async () => {
    const o = await tiffinOutlet();
    mocks.session = { userId: o.userId };
    const m = ctx("outletId", o.outletId);
    const put = (body: unknown) => menuPUT(dash(`/api/tiffin/${o.outletId}/menu`, "PUT", body), m);
    expect((await put({ kind: "nope", slot })).status).toBe(422);
    expect((await put({ kind: "slot", slot, extra: 1 })).status).toBe(422);
    expect((await put({ kind: "slot", slot: { ...slot, extra: 1 } })).status).toBe(422);
    expect((await put({ slot })).status).toBe(422);
  });

  it("treats a cross-organization outlet exactly like a nonexistent one", async () => {
    const mine = await tiffinOutlet();
    const theirs = await tiffinOutlet();
    mocks.session = { userId: mine.userId };
    const call = async (outletId: string) => {
      const res = await menuGET(
        dash(`/api/tiffin/${outletId}/menu`, "GET"),
        ctx("outletId", outletId)
      );
      return { status: res.status, body: await res.json() };
    };
    const foreign = await call(theirs.outletId);
    const missing = await call(crypto.randomUUID());
    expect(foreign.status).toBe(403);
    expect(foreign).toEqual(missing);
    const write = await comboPOST(
      dash(`/api/tiffin/${theirs.outletId}/combos`, "POST", combo),
      ctx("outletId", theirs.outletId)
    );
    expect(write.status).toBe(403);
  });
});

describe("public tiffin routes", () => {
  it("serve the week with no-store, validated query params and string money", async () => {
    const o = await seeded();
    const res = await weekGET(week(o.token), ctx("publicMenuId", o.token));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.days).toHaveLength(7);
    expect(body.days[0].slots.lunch.combos[0].priceMinor).toBe("12000");
    expect(JSON.stringify(body)).not.toContain("organization");

    const from = body.days[0].localDate as string;
    const two = await weekGET(week(o.token, `?from=${from}&days=2`), ctx("publicMenuId", o.token));
    expect((await two.json()).days).toHaveLength(2);

    for (const qs of ["?days=0", "?days=15", "?days=abc", "?from=2026-02-30", "?from=x"]) {
      const bad = await weekGET(week(o.token, qs), ctx("publicMenuId", o.token));
      expect(bad.status, qs).toBe(422);
      expect(bad.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("quote returns the priced selection with decimal-string money", async () => {
    const o = await seeded();
    const w = await (await weekGET(week(o.token), ctx("publicMenuId", o.token))).json();
    const localDate = w.days[0].localDate;
    const res = await quotePOST(
      pub(o.token, {
        localDate,
        slotKind: "lunch",
        lines: [{ comboId: o.combo.id, quantity: 2, addonIds: [o.combo.addons[0].id] }],
      }),
      ctx("publicMenuId", o.token)
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const quote = await res.json();
    expect(typeof quote.totalMinor).toBe("string");
    expect(quote.totalMinor).toBe("26000");
    expect(quote.lines[0].lineMinor).toBe("26000");
  });

  it("answers identical 404s for flag off, unknown, malformed and revoked tokens", async () => {
    const o = await seeded();
    const body = {
      localDate: "2030-01-01",
      slotKind: "lunch",
      lines: [{ comboId: "x", addonIds: [], quantity: 1 }],
    };
    const results: string[] = [];
    const collect = async (r: Response) => {
      expect(r.status).toBe(404);
      expect(r.headers.get("cache-control")).toBe("no-store");
      results.push(await r.text());
    };
    await collect(await weekGET(week("unknown_token_1"), ctx("publicMenuId", "unknown_token_1")));
    await collect(await weekGET(week("bad token!"), ctx("publicMenuId", "bad token!")));
    await collect(
      await quotePOST(pub("unknown_token_1", body), ctx("publicMenuId", "unknown_token_1"))
    );
    await admin(async (_db, p) => {
      await p.query("update qr_codes set is_active=false where destination_token=$1", [o.token]);
    });
    vi.stubEnv("TIFFIN_ENABLED", "false");
    await collect(await weekGET(week(o.token), ctx("publicMenuId", o.token)));
    await collect(await quotePOST(pub(o.token, body), ctx("publicMenuId", o.token)));
    expect(new Set(results).size).toBe(1);
    expect(mocks.reserveSource).toHaveBeenCalledTimes(3);
  });

  it("quote enforces origin (403), JSON (415) and the 16 KiB bound (413)", async () => {
    const t = "some_public_token";
    const m = ctx("publicMenuId", t);
    expect((await quotePOST(pub(t, {}, { origin: "https://evil.invalid" }), m)).status).toBe(403);
    expect((await quotePOST(pub(t, "x", { "content-type": "text/plain" }), m)).status).toBe(415);
    expect(mocks.reserveSource).not.toHaveBeenCalled();

    const declared = pub(t, "{}", { "content-length": "16385" });
    expect((await quotePOST(declared, m)).status).toBe(413);

    // Chunked body without Content-Length: boundedBytes enforces the limit.
    const big = new Uint8Array(16385).fill(32);
    const streamed = new Request(`${origin}/api/public-tiffin/${t}/quote`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(big);
          c.close();
        },
      }),
      duplex: "half",
    } as RequestInit);
    const res = await quotePOST(streamed, m);
    expect(res.status).toBe(413);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect((await quotePOST(pub(t, "{not json"), m)).status).toBe(400);
  });

  it("rate limits both routes (429) before reading a body or querying", async () => {
    const t = "some_public_token";
    mocks.reserveSource.mockResolvedValue(false);
    const q = await quotePOST(pub(t, "{}"), ctx("publicMenuId", t));
    expect(q.status).toBe(429);
    expect(q.headers.get("cache-control")).toBe("no-store");
    const w = await weekGET(week(t), ctx("publicMenuId", t));
    expect(w.status).toBe(429);
    expect(w.headers.get("cache-control")).toBe("no-store");

    mocks.reserveSource.mockResolvedValue(true);
    mocks.reserveToken.mockResolvedValue(false);
    expect((await quotePOST(pub(t, "{}"), ctx("publicMenuId", t))).status).toBe(429);
    expect((await weekGET(week(t), ctx("publicMenuId", t))).status).toBe(429);
    expect(mocks.reserveToken).toHaveBeenCalledWith("quote", "203.0.113.10", t);
    expect(mocks.reserveToken).toHaveBeenCalledWith("week", "203.0.113.10", t);
  });

  it("fails closed with 503 on an untrusted source or a Redis failure", async () => {
    const t = "some_public_token";
    mocks.verifiedOrderSource.mockImplementation(() => {
      throw new Error("untrusted");
    });
    expect((await quotePOST(pub(t, "{}"), ctx("publicMenuId", t))).status).toBe(503);
    expect((await weekGET(week(t), ctx("publicMenuId", t))).status).toBe(503);
    mocks.verifiedOrderSource.mockReturnValue("203.0.113.10");
    mocks.reserveSource.mockRejectedValue(new Error("redis down"));
    const res = await weekGET(week(t), ctx("publicMenuId", t));
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    mocks.reserveSource.mockResolvedValue(true);
    mocks.reserveToken.mockRejectedValue(new Error("redis down"));
    expect((await quotePOST(pub(t, "{}"), ctx("publicMenuId", t))).status).toBe(503);
  });
});
