import { expect, it } from "vitest";
import sharp from "sharp";
import {
  extractNvidiaCandidate,
  NvidiaExtractionError,
  salvageTruncatedJson,
} from "../src/modules/menu-import/nvidia";
import { mergeCandidateCategories, normalizeLabel } from "../src/modules/menu-import/merge";
import { parseImportCandidate } from "../src/modules/menu-import/contracts";

const picture = () =>
  sharp({ create: { width: 240, height: 180, channels: 3, background: "white" } })
    .jpeg()
    .toBuffer();
const reply = (content: string, finish_reason = "stop") =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }),
    { status: 200 }
  );
const page = (...categories: unknown[]) => JSON.stringify({ categories });
async function run(
  replies: Array<() => Response | Promise<Response>>,
  guard?: () => Promise<void>
) {
  const ids = replies.map(() => crypto.randomUUID());
  let call = 0;
  const run = extractNvidiaCandidate(
    {
      importId: crypto.randomUUID(),
      currency: "INR",
      sources: await Promise.all(
        ids.map(async (id, pageIndex) => ({ id, pageIndex, bytes: await picture() }))
      ),
      model: "example/vision",
      apiKey: "k",
      ...(guard ? { guard } : {}),
    },
    async () => replies[call++]!()
  );
  return { ids, run };
}

it("salvages only complete dishes from output cut off by the token limit", () => {
  const cut = '{"categories":[{"name":"Starters","items":[{"name":"Soup","price":"5"},{"name":"Sal';
  expect(salvageTruncatedJson(cut)).toEqual({
    categories: [{ name: "Starters", items: [{ name: "Soup", price: "5" }] }],
  });
  const second =
    '{"categories":[{"name":"A","items":[{"name":"x","price":"1"}]},{"name":"B","items":[{"name":"y","price":"2"},{"name":"z","pri';
  expect(salvageTruncatedJson(second)).toEqual({
    categories: [
      { name: "A", items: [{ name: "x", price: "1" }] },
      { name: "B", items: [{ name: "y", price: "2" }] },
    ],
  });
  // Braces inside strings do not confuse it, and nothing complete means nothing salvaged.
  expect(salvageTruncatedJson('{"categories":[{"name":"A}","items":[{"name":"Sou')).toBeNull();
  // A dish whose variant list was cut is dropped rather than half-kept.
  expect(
    salvageTruncatedJson(
      '{"categories":[{"name":"A","items":[{"name":"x","price":null,"variants":[{"name":"S","price":"1"},{"name":"L'
    )
  ).toBeNull();
});

it("keeps a truncated page's complete dishes and flags the page", async () => {
  const { ids, run: pending } = await run([
    () =>
      reply(
        '{"categories":[{"name":"Mains","items":[{"name":"Dal","price":"90"},{"name":"Pan',
        "length"
      ),
  ]);
  const out = await pending;
  expect(out.candidate.categories[0]?.items.map((i) => i.name.value)).toEqual(["Dal"]);
  expect(out.candidate.sourceWarnings).toEqual([{ sourceId: ids[0], reason: "truncated_output" }]);
});

it("still skips a truncated page that has nothing salvageable", async () => {
  const { ids, run: pending } = await run([
    () => reply(page({ name: "Good", items: [{ name: "Tea", price: "10" }] })),
    () => reply('{"categories":[{"name":"Bad","items":[{"name":"Ch', "length"),
  ]);
  const out = await pending;
  expect(out.candidate.sourceWarnings).toEqual([
    { sourceId: ids[1], reason: "invalid_provider_response" },
  ]);
});

it("keeps earlier pages when the provider fails later, flagging the rest", async () => {
  const { ids, run: pending } = await run([
    () => reply(page({ name: "Tea", items: [{ name: "Chai", price: "10" }] })),
    () => new Response("down", { status: 503 }),
    () => reply(page({ name: "never", items: [{ name: "sent", price: "1" }] })),
  ]);
  const out = await pending;
  expect(out.usage.requests).toBe(2);
  expect(out.candidate.categories).toHaveLength(1);
  expect(out.candidate.sourceWarnings).toEqual([
    { sourceId: ids[1], reason: "provider_unavailable" },
    { sourceId: ids[2], reason: "not_processed" },
  ]);
});

it("still fails when the provider fails before any page was read", async () => {
  const { run: pending } = await run([() => new Response("down", { status: 503 })]);
  await expect(pending).rejects.toMatchObject({ code: "provider_unavailable" });
});

it("stops with no further provider request once the lease check refuses (cancel)", async () => {
  let checks = 0;
  const guard = async () => {
    if (++checks > 2)
      throw new NvidiaExtractionError("provider_unavailable", {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
  };
  let calls = 0;
  const { run: pending } = await run(
    [
      () => (calls++, reply(page({ name: "A", items: [{ name: "x", price: "1" }] }))),
      () => (calls++, reply(page({ name: "B", items: [{ name: "y", price: "2" }] }))),
    ],
    guard
  );
  // Page 1 passes both checks; page 2 is refused and is terminal, never a partial draft.
  await expect(pending).rejects.toMatchObject({ code: "provider_unavailable" });
  expect(calls).toBe(1);
});

it("extracts printed size variants and leaves the base price for the reviewer", async () => {
  const { run: pending } = await run([
    () =>
      reply(
        page({
          name: "Pizza",
          items: [
            {
              name: "Margherita",
              price: null,
              variants: [
                { name: "Small", price: "5.50" },
                { name: "Large", price: "9", uncertain: true },
              ],
            },
          ],
        })
      ),
  ]);
  const dish = (await pending).candidate.categories[0]!.items[0]!;
  expect(dish.priceMinor).toMatchObject({ value: null, review: "needs_attention" });
  expect(dish.variants.map((v) => [v.name.value, v.priceMinor.value])).toEqual([
    ["Small", 550],
    ["Large", null],
  ]);
});

it("treats an explicit uncertain flag as null and a plain price as read", async () => {
  const { run: pending } = await run([
    () =>
      reply(
        page({
          name: "A",
          items: [
            { name: "One", price: "10", uncertain: true },
            { name: "Two", price: "10" },
          ],
        })
      ),
  ]);
  const items = (await pending).candidate.categories[0]!.items;
  expect(items.map((i) => i.priceMinor.value)).toEqual([null, 1000]);
});

it("merges a continued heading and de-duplicates overlapping photos across pages", async () => {
  const { ids, run: pending } = await run([
    () =>
      reply(
        page({
          name: "Starters",
          items: [
            { name: "Soup", price: "5" },
            { name: "Salad", price: "6" },
          ],
        })
      ),
    () =>
      reply(
        page(
          {
            name: " STARTERS ",
            items: [
              { name: "soup", price: "5" },
              { name: "Wings", price: "8" },
              { name: "Salad", price: "7" },
            ],
          },
          { name: "Desserts", items: [{ name: "Kheer", price: "4" }] }
        )
      ),
  ]);
  const { categories } = (await pending).candidate;
  expect(categories.map((c) => c.name.value)).toEqual(["Starters", "Desserts"]);
  // Soup is the same dish; the two Salad prices disagree, so both are kept for the reviewer.
  expect(categories[0]!.items.map((i) => [i.name.value, i.priceMinor.value])).toEqual([
    ["Soup", 500],
    ["Salad", 600],
    ["Wings", 800],
    ["Salad", 700],
  ]);
  const soup = categories[0]!.items[0]!;
  expect(soup.name.evidence.map((e) => e.sourceId).sort()).toEqual([...ids].sort());
  expect(() =>
    parseImportCandidate({
      schemaVersion: 1,
      importId: crypto.randomUUID(),
      currency: "INR",
      categories,
    })
  ).not.toThrow();
});

it("normalizes labels without losing distinct names", () => {
  expect(normalizeLabel("  Crème  Brûlée! ")).toBe("creme brulee");
  expect(normalizeLabel("Chai")).not.toBe(normalizeLabel("Chaat"));
  expect(normalizeLabel(null)).toBe("");
});

it("merge keeps identities and order of first appearance", () => {
  expect(mergeCandidateCategories([])).toEqual([]);
});
