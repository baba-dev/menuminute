import { afterEach, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import sharp from "sharp";
import { fixture, admin } from "./helpers";
import { withActor } from "../src/modules/tenancy/service";
import { createImport, addImportSource, importDetail } from "../src/modules/menu-import/service";
import {
  extractNvidiaCandidate,
  importEngineEnabled,
  importOutputTokenBudget,
  NvidiaExtractionError,
} from "../src/modules/menu-import/nvidia";
import { processImport } from "../src/modules/menu-import/engine";

afterEach(() => {
  vi.unstubAllEnvs();
});
const picture = () =>
  sharp({ create: { width: 240, height: 180, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
it("requires explicit production-entitlement gates", () => {
  expect(
    importEngineEnabled({ MENU_IMPORT_NVIDIA_ENABLED: "true", NVIDIA_IMPORT_MODEL: "test/vision" })
  ).toBe(false);
  expect(
    importEngineEnabled({
      MENU_IMPORT_NVIDIA_ENABLED: "true",
      NVIDIA_IMPORT_COMMERCIAL_APPROVED: "true",
      NVIDIA_IMPORT_MODEL: "test/vision",
    })
  ).toBe(true);
  expect(
    importEngineEnabled({
      MENU_IMPORT_NVIDIA_ENABLED: "true",
      NVIDIA_IMPORT_COMMERCIAL_APPROVED: "true",
      NVIDIA_IMPORT_MODEL: "../ bad",
    })
  ).toBe(false);
});
it("bounds model-specific output budgets without user-controlled provider parameters", () => {
  expect(importOutputTokenBudget({})).toBe(4096);
  expect(importOutputTokenBudget({ NVIDIA_IMPORT_MAX_OUTPUT_TOKENS: "6144" })).toBe(6144);
  expect(importOutputTokenBudget({ NVIDIA_IMPORT_MAX_OUTPUT_TOKENS: "99999" })).toBeNull();
  expect(importOutputTokenBudget({ NVIDIA_IMPORT_MAX_OUTPUT_TOKENS: "bad" })).toBeNull();
});
it("maps synthetic NVIDIA page JSON into candidate v1 with exact private source provenance and currency minor units", async () => {
  const id = crypto.randomUUID(),
    sourceId = crypto.randomUUID();
  const request = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
    expect(JSON.stringify(options?.body)).not.toContain("sample-secret");
    expect(options?.headers).toMatchObject({ Authorization: "Bearer sample-secret" });
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                categories: [
                  {
                    name: "Starters",
                    items: [
                      { name: "Paneer", description: null, price: "12.50", uncertain: false },
                      { name: "Special", description: null, price: "maybe 10", uncertain: true },
                    ],
                  },
                ],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 123, completion_tokens: 43 },
      }),
      { status: 200 }
    );
  }) as unknown as typeof fetch;
  const out = await extractNvidiaCandidate(
    {
      importId: id,
      currency: "INR",
      sources: [{ id: sourceId, pageIndex: 0, bytes: await picture() }],
      model: "example/vision",
      apiKey: "sample-secret",
    },
    request
  );
  expect(out.usage).toEqual({ requests: 1, inputTokens: 123, outputTokens: 43 });
  expect(out.candidate.categories[0]?.items[0]?.priceMinor).toMatchObject({
    value: 1250,
    evidence: [{ sourceId, excerpt: "12.50" }],
  });
  expect(out.candidate.categories[0]?.items[1]?.priceMinor).toMatchObject({
    value: null,
    review: "needs_attention",
  });
  const sent = JSON.parse(String((request as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body));
  expect(sent.messages[0].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  expect(sent.messages[0].content[1].image_url.url).not.toContain("imports/");
});
it("rejects untrusted provider output, never fabricating a recognized candidate", async () => {
  const image = await picture();
  await expect(
    extractNvidiaCandidate(
      {
        importId: crypto.randomUUID(),
        currency: "INR",
        sources: [{ id: crypto.randomUUID(), pageIndex: 0, bytes: image }],
        model: "example/vision",
        apiKey: "k",
      },
      async () => new Response(JSON.stringify({ choices: [{ message: { content: "not json" } }] }))
    )
  ).rejects.toBeInstanceOf(NvidiaExtractionError);
});
it("accepts fenced JSON while leaving uncertain prices null", async () => {
  const sourceId = crypto.randomUUID();
  const out = await extractNvidiaCandidate(
    {
      importId: crypto.randomUUID(),
      currency: "INR",
      sources: [{ id: sourceId, pageIndex: 0, bytes: await picture() }],
      model: "example/vision",
      apiKey: "k",
    },
    async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  "\x60\x60\x60json\n" +
                  JSON.stringify({
                    categories: [{ name: "Snacks", items: [{ name: "Chowmein", price: "75" }] }],
                  }) +
                  "\n\x60\x60\x60",
              },
            },
          ],
        })
      )
  );
  expect(out.candidate.categories[0]?.items[0]?.priceMinor).toMatchObject({
    value: null,
    review: "needs_attention",
  });
  expect(out.usage.requests).toBe(1);
});
it("retains good pages and records rejected ones without bypassing review", async () => {
  const bad = crypto.randomUUID(),
    good = crypto.randomUUID();
  let calls = 0;
  const out = await extractNvidiaCandidate(
    {
      importId: crypto.randomUUID(),
      currency: "INR",
      sources: [
        { id: bad, pageIndex: 0, bytes: await picture() },
        { id: good, pageIndex: 1, bytes: await picture() },
      ],
      model: "example/vision",
      apiKey: "k",
    },
    async () => {
      calls++;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  calls === 1
                    ? "{broken"
                    : JSON.stringify({
                        categories: [
                          {
                            name: "Meals",
                            items: [
                              {
                                name: "Veg Burger",
                                description: null,
                                price: "75",
                                uncertain: false,
                              },
                            ],
                          },
                        ],
                      }),
              },
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 50 },
        })
      );
    }
  );
  expect(out.usage.requests).toBe(2);
  expect(out.candidate.categories[0]?.items[0]?.name.value).toBe("Veg Burger");
  expect(out.candidate.categories[0]?.items[0]?.priceMinor.value).toBe(7500);
  expect(out.candidate.sourceWarnings).toEqual([
    { sourceId: bad, reason: "invalid_provider_response" },
  ]);
});
it("does not issue more billable pages following an unavailable provider", async () => {
  let calls = 0;
  await expect(
    extractNvidiaCandidate(
      {
        importId: crypto.randomUUID(),
        currency: "INR",
        sources: [
          { id: crypto.randomUUID(), pageIndex: 0, bytes: await picture() },
          { id: crypto.randomUUID(), pageIndex: 1, bytes: await picture() },
        ],
        model: "example/vision",
        apiKey: "k",
      },
      async () => {
        calls++;
        return new Response("upstream failure", { status: 503 });
      }
    )
  ).rejects.toMatchObject({ code: "provider_unavailable" });
  expect(calls).toBe(1);
});
it("durably queues, meters, and writes a review-only candidate using the restricted worker role", async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "menu-nim-test-"));
  const umask = process.umask(0o007);
  vi.stubEnv("MEDIA_ROOT", base);
  vi.stubEnv("MEDIA_STORAGE", "local");
  vi.stubEnv("MENU_IMPORT_NVIDIA_ENABLED", "true");
  vi.stubEnv("NVIDIA_IMPORT_COMMERCIAL_APPROVED", "true");
  vi.stubEnv("NVIDIA_IMPORT_MODEL", "test/vision");
  vi.stubEnv("NVIDIA_API_KEY", "unit-test-not-sent");
  try {
    await fs.chmod(base, 0o2770);
    const f = await fixture(),
      id = crypto.randomUUID(),
      sourceId = crypto.randomUUID();
    await createImport(f.actor, f.outlet.id, { id, key: crypto.randomUUID() });
    await addImportSource(
      f.actor,
      f.outlet.id,
      id,
      { id: sourceId, pageIndex: 0 },
      await picture()
    );
    const before = await importDetail(f.actor, f.outlet.id, id);
    const queued = await withActor(
      f.actor,
      async (tx) =>
        (
          await tx.execute<{ result: { status: string; revision: number } }>(
            sql`select app_private.import_enqueue(${f.outlet.id},${id},${before.revision}) as result`
          )
        ).rows[0]!.result
    );
    expect(queued.status).toBe("queued");
    const eventId = await admin(
      async (_db, pool) =>
        (
          await pool.query<{ id: string }>(
            "select id from outbox_events where type='menu_import.process' and payload->>'importId'=$1",
            [id]
          )
        ).rows[0]!.id
    );
    const pool = new Pool({ connectionString: process.env["WORKER_DATABASE_URL"], max: 1 });
    try {
      const mock = vi.fn(async (input: Parameters<typeof extractNvidiaCandidate>[0]) => ({
        usage: { requests: 1, inputTokens: 10, outputTokens: 20 },
        candidate: {
          schemaVersion: 1 as const,
          importId: input.importId,
          currency: input.currency,
          categories: [
            {
              id: crypto.randomUUID(),
              name: { value: "Mains", review: "unreviewed" as const, evidence: [{ sourceId }] },
              items: [
                {
                  id: crypto.randomUUID(),
                  name: { value: "Curry", review: "unreviewed" as const, evidence: [{ sourceId }] },
                  priceMinor: {
                    value: null,
                    review: "needs_attention" as const,
                    evidence: [{ sourceId }],
                  },
                  variants: [],
                },
              ],
            },
          ],
        },
      })) as unknown as typeof extractNvidiaCandidate;
      expect(await processImport(pool, eventId, f.outlet.organizationId, mock)).toBe(true);
      expect(await processImport(pool, eventId, f.outlet.organizationId, mock)).toBe(false);
      expect(mock).toHaveBeenCalledTimes(1);
      const detail = await importDetail(f.actor, f.outlet.id, id);
      expect(detail.status).toBe("needs_review");
      expect(detail.candidate?.document).toMatchObject({ schemaVersion: 1, importId: id });
      expect(before.candidate).toBeNull();
      const usage = await admin(
        async (_db, owner) =>
          (
            await owner.query(
              "select state,requests,input_tokens,output_tokens from menu_import_ai_usage where event_id=$1",
              [eventId]
            )
          ).rows[0]
      );
      expect(usage).toMatchObject({
        state: "completed",
        requests: 1,
        input_tokens: 10,
        output_tokens: 20,
      });
    } finally {
      await pool.end();
    }
  } finally {
    process.umask(umask);
    await fs.rm(base, { recursive: true, force: true });
  }
});
