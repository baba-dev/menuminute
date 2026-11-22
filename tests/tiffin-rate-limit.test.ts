import { createHash } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  TIFFIN_SOURCE_LIMIT,
  TIFFIN_TOKEN_LIMIT,
  reserveTiffinPublicSource,
  reserveTiffinPublicToken,
} from "../src/modules/tiffin/rate-limit";
import { redisClient } from "../src/lib/redis";

// Real Redis (cache workload). Every key is unique per run and deleted afterwards.
const hash = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 32);
const uniq = () => crypto.randomUUID().replaceAll("-", "");
const ip = (i: number) => `198.51.${Math.floor(i / 250)}.${i % 250}`;
const created: string[] = [];
const keep = (...keys: string[]) => created.push(...keys);

afterAll(async () => {
  const redis = await redisClient("cache");
  if (created.length) await redis.del(created);
});

describe("tiffin public rate limits (real Redis)", () => {
  it("admits the first request of 150 distinct sources for one token", async () => {
    for (const op of ["week", "quote"] as const) {
      const token = `tok-${uniq()}`;
      keep(`tiffin:cap:${op}:token:${hash(token)}`);
      for (let i = 0; i < 150; i++) {
        const source = ip(i);
        keep(`tiffin:cap:${op}:source:${hash(source)}:${hash(token)}`);
        expect(await reserveTiffinPublicToken(op, source, token), `${op} ${i}`).toBe(true);
      }
    }
  });

  it("throttles one source at its limit without advancing token or global counters", async () => {
    const redis = await redisClient("cache");
    for (const op of ["week", "quote"] as const) {
      const source = `2001:db8:${uniq().slice(0, 4)}::${uniq().slice(0, 4)}`;
      const sourceKey = `tiffin:edge:${op}:ip:${hash(source)}`;
      const globalKey = `tiffin:edge:${op}:global`;
      keep(sourceKey);
      const globalBefore = Number((await redis.get(globalKey)) ?? 0);
      for (let i = 0; i < TIFFIN_SOURCE_LIMIT[op]; i++)
        expect(await reserveTiffinPublicSource(op, source)).toBe(true);
      const globalAdmitted = Number((await redis.get(globalKey)) ?? 0);
      expect(globalAdmitted - globalBefore).toBe(TIFFIN_SOURCE_LIMIT[op]);
      for (let i = 0; i < 10; i++) expect(await reserveTiffinPublicSource(op, source)).toBe(false);
      // Denied requests were stopped at the most specific counter: global did not advance.
      expect(Number((await redis.get(globalKey)) ?? 0)).toBe(globalAdmitted);

      // Per source+token: the throttled pair must not advance the token-wide counter.
      const token = `tok-${uniq()}`;
      const tokenKey = `tiffin:cap:${op}:token:${hash(token)}`;
      const pairKey = `tiffin:cap:${op}:source:${hash(source)}:${hash(token)}`;
      keep(tokenKey, pairKey);
      let admitted = 0;
      while (await reserveTiffinPublicToken(op, source, token)) admitted++;
      expect(admitted).toBeGreaterThan(0);
      expect(admitted).toBeLessThan(TIFFIN_TOKEN_LIMIT);
      const tokenAfter = Number(await redis.get(tokenKey));
      expect(tokenAfter).toBe(admitted);
      expect(await reserveTiffinPublicToken(op, source, token)).toBe(false);
      expect(Number(await redis.get(tokenKey))).toBe(tokenAfter);
    }
  });

  it("still caps one token across distinct sources at TIFFIN_TOKEN_LIMIT", async () => {
    const token = `tok-${uniq()}`;
    keep(`tiffin:cap:week:token:${hash(token)}`);
    for (let i = 0; i < TIFFIN_TOKEN_LIMIT; i++) {
      const source = `203.${Math.floor(i / 60000)}.${Math.floor(i / 250) % 250}.${i % 250}-${i}`;
      keep(`tiffin:cap:week:source:${hash(source)}:${hash(token)}`);
      expect(await reserveTiffinPublicToken("week", source, token), `admission ${i}`).toBe(true);
    }
    expect(await reserveTiffinPublicToken("week", "203.0.113.250", token)).toBe(false);
  });
});
