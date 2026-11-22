import { getPool } from "@/db";
import { withActor } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import type { AdminActor } from "@/lib/admin-guard";
import { FoodDraftSchema, type FoodDraft, type FoodEditorialDetail, type FoodEditorialRow, type FoodEditorialAction } from "./editorial-contracts";
import { type FoodEntry, FoodEntrySchema, type FoodKind } from "./contracts";

function parseFoodRow(value: unknown): FoodEntry | null {
  const result = FoodEntrySchema.safeParse(value);
  return result.success && result.data.status === "published" ? result.data : null;
}
/** Queries read only a vetted projection of approved and published revisions. */
export async function getPublishedFoodEntry(kind: FoodKind, slug: string): Promise<FoodEntry | null> {
  try {
    const r = await getPool().query<{ entry: unknown }>(
      "SELECT app_private.food_public_entry($1,$2) AS entry", [kind, slug]
    );
    return parseFoodRow(r.rows[0]?.entry);
  } catch {
    // During additive deployments, a missing migration must fail closed rather
    // than exposing drafts, throwing a site-wide 500, or claiming published content.
    return null;
  }
}
export async function listPublishedFood(kind?: FoodKind, query?: string, limit = 40): Promise<FoodEntry[]> {
  try {
    const r = await getPool().query<{ entry: unknown }>(
      "SELECT entry FROM app_private.food_public_list($1,$2,$3)",
      [kind ?? null, (query ?? "").trim().slice(0, 100), Math.min(100,Math.max(1,limit))]
    );
    return r.rows.flatMap(({ entry }) => { const parsed = parseFoodRow(entry); return parsed ? [parsed] : []; });
  } catch { return []; }
}
export async function getPublicFoodRedirect(kind: FoodKind, slug: string): Promise<string | null> {
  try {
    const r = await getPool().query<{ slug: string | null }>(
      "SELECT app_private.food_public_redirect($1,$2) AS slug", [kind,slug]);
    return r.rows[0]?.slug ?? null;
  } catch { return null; }
}
export async function listEditorialEntries(actor: AdminActor, query = "", status = ""): Promise<FoodEditorialRow[]> {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async tx => {
    const result = await tx.execute<{ item: FoodEditorialRow }>(
      sql`SELECT item FROM app_private.food_editorial_list(${query.slice(0,100)},${status},80)`
    );
    return result.rows.map(row => row.item);
  });
}
export async function getEditorialDetail(actor: AdminActor, id: string): Promise<FoodEditorialDetail | null> {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async tx => {
    const result = await tx.execute<{ detail: FoodEditorialDetail | null }>(
      sql`SELECT app_private.food_editorial_detail(${id}) AS detail`
    );
    return result.rows[0]?.detail ?? null;
  });
}
export type EditorialCommandReceipt = { id: string; status?: string; revisionId?: string; version?: number; digest?: string };
export async function runEditorialCommand(actor: AdminActor, action: FoodEditorialAction | "media.approve" | "import", targetId: string,
 data: { content?: FoodDraft; expectedVersion?: number; revisionId?: string; license?: string; attribution?: string; path?: string },
 requestKey: string = crypto.randomUUID()): Promise<EditorialCommandReceipt> {
  if (!actor.sessionId) throw new Error("A live authenticated administrative session is required");
  const payload = { ...data, ...(data.content ? { content: FoodDraftSchema.parse(data.content) } : {}) };
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async tx => {
    const result = await tx.execute<{ result: EditorialCommandReceipt }>(
      sql`SELECT app_private.food_editorial_command(
       ${action},${targetId},${JSON.stringify(payload)}::jsonb,${requestKey}
      ) AS result`
    );
    if (!result.rows[0]) throw new Error("No editorial command receipt");
    return result.rows[0].result;
  });
}
