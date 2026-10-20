import type { Pool } from "pg";
import { importId, parseImportCandidate } from "./contracts";
import { digest, getPrivateSource } from "./storage";
import {
  extractNvidiaCandidate,
  importEngineEnabled,
  NvidiaExtractionError,
  type Meter,
} from "./nvidia";

type Work = {
  done?: boolean;
  importId?: string;
  currency?: string;
  sources?: Array<{ id: string; pageIndex: number; key: string; sha: string }>;
};
/** Worker role has no direct SELECT on private import/source/tenant tables. */
export async function processImport(
  pool: Pool,
  eventId: string,
  organizationId: string,
  extractor: typeof extractNvidiaCandidate = extractNvidiaCandidate
) {
  const model = process.env["NVIDIA_IMPORT_MODEL"] ?? "";
  const enabled = importEngineEnabled() && Boolean(process.env["NVIDIA_API_KEY"]);
  const prepared = await pool.query<{ result: Work }>(
    "select app_private.import_engine_begin($1,$2,$3) as result",
    [eventId, organizationId, model || "unconfigured"]
  );
  const work = prepared.rows[0]?.result;
  if (!work || work.done) return false;
  const usage: Meter = { requests: 0, inputTokens: 0, outputTokens: 0 };
  let result: { ok: boolean; candidate?: unknown; usage: Meter; error?: string } = {
    ok: false,
    usage,
    error: "engine_unavailable",
  };
  try {
    if (!enabled || !work.importId || !work.currency || !work.sources?.length)
      throw new NvidiaExtractionError("provider_unavailable", usage);
    const sources = await Promise.all(
      work.sources.map(async (s) => {
        importId.parse(s.id);
        const bytes = await getPrivateSource(s.key);
        if (digest(bytes) !== s.sha) throw new NvidiaExtractionError("source_unavailable", usage);
        return { id: s.id, pageIndex: s.pageIndex, bytes };
      })
    );
    const extracted = await extractor({
      importId: work.importId,
      currency: work.currency,
      sources,
      model,
      apiKey: process.env["NVIDIA_API_KEY"]!,
    });
    const candidate = parseImportCandidate(extracted.candidate);
    const known = new Set(sources.map((s) => s.id));
    for (const c of candidate.categories) {
      for (const field of [
        c.name,
        ...c.items.flatMap((i) => [
          i.name,
          ...(i.description ? [i.description] : []),
          i.priceMinor,
          ...i.variants.flatMap((v) => [v.name, v.priceMinor]),
        ]),
      ]) {
        if (field.evidence.some((e) => !known.has(e.sourceId)))
          throw new NvidiaExtractionError("invalid_provider_response", extracted.usage);
      }
    }
    result = { ok: true, candidate, usage: extracted.usage };
  } catch (err) {
    result = {
      ok: false,
      usage: err instanceof NvidiaExtractionError ? err.usage : usage,
      error: err instanceof NvidiaExtractionError ? err.code : "processing_failed",
    };
  }
  await pool.query("select app_private.import_engine_finish($1,$2,$3::jsonb)", [
    eventId,
    organizationId,
    JSON.stringify(result),
  ]);
  return result.ok;
}
