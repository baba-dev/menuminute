import rawCatalogue from "@/data/dish-catalogue.json";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { withActor } from "@/modules/tenancy/service";
import type { AdminActor } from "@/lib/admin-guard";
import type { FoodDraft } from "./editorial-contracts";
import { newEditorialDraft } from "./editorial-template";
const RowSchema = z.object({
  id: z.string().max(80).min(5),
  name: z.string().max(100).min(3),
  categoryHint: z.string().max(90),
  aliases: z.array(z.string().max(90)).max(20),
  publicDescription: z.string().max(320),
});
export const catalogueCandidates = rawCatalogue.flatMap((record) => {
  const parsed = RowSchema.safeParse(record);
  if (!parsed.success) return [];
  return [
    {
      id: parsed.data.id,
      name: parsed.data.name,
      hint: parsed.data.categoryHint,
      suggestion: parsed.data.publicDescription,
      aliases: parsed.data.aliases,
    },
  ];
});
export type Candidate = (typeof catalogueCandidates)[number];
export type StoredCandidate = Candidate & { status: "pending" | "promoted" | "dismissed" };
const slugFor = (name: string): string =>
  name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 90);
export function draftFromCandidate(candidate: Candidate): FoodDraft {
  const draft = newEditorialDraft("dishes", slugFor(candidate.name) || "untitled-food");
  return {
    ...draft,
    title: candidate.name,
    aliases: candidate.aliases.filter((a) => a.length >= 2),
    // Suggestion text is deliberately NOT copied into a factual claim.
    description: `Research pending: learn about ${candidate.name} through a source-backed guide that has not yet been written or approved.`,
    eyebrow: "CATALOGUE CANDIDATE / UNREVIEWED",
  };
}
export async function listStoredCandidates(actor: AdminActor): Promise<StoredCandidate[]> {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (tx) => {
    const r = await tx.execute<{ candidate: StoredCandidate }>(
      sql`SELECT candidate FROM app_private.food_editorial_candidates(250)`
    );
    return r.rows.map((x) => x.candidate);
  });
}
export async function importCandidateQueue(
  actor: AdminActor,
  requestKey: string
): Promise<{ imported: number; total: number }> {
  return withActor({ userId: actor.id, sessionId: actor.sessionId }, async (tx) => {
    const r = await tx.execute<{ result: { imported: number; total: number } }>(
      sql`SELECT app_private.food_import_candidates(${JSON.stringify(catalogueCandidates)}::jsonb,${requestKey}) AS result`
    );
    if (!r.rows[0]) throw new Error("No candidate import receipt");
    return r.rows[0].result;
  });
}
