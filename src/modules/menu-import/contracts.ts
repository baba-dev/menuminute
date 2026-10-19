import { z } from "zod";

/** Candidate v1 is untrusted recognition data; it is never a publishable MenuDocument. */
export const importId = z.uuid();
export const sourceLimit = 12;
export const sourceByteLimit = 5 * 1024 * 1024;
export const sessionByteLimit = 30 * 1024 * 1024;
const boundedText = (max: number) => z.string().trim().max(max);
const evidence = z.object({
  sourceId: importId,
  excerpt: boundedText(500).optional(),
  // Normalized [0,1] coordinates, only supplied where the provider returned real bounds.
  region: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]).refine(
    ([left, top, right, bottom]) => right > left && bottom > top, "Invalid source region"
  ).optional(),
}).strict();
const recognition = z.object({
  value: boundedText(1000).nullable(),
  review: z.enum(["unreviewed", "needs_attention", "unreadable"]).default("unreviewed"),
  evidence: z.array(evidence).max(12),
}).strict();
const price = recognition.safeExtend({
  value: z.number().int().min(0).max(2147483647).nullable(),
});
const candidateVariant = z.object({
  id: importId,
  name: recognition,
  priceMinor: price,
}).strict();
const candidateDish = z.object({
  id: importId,
  name: recognition,
  description: recognition.optional(),
  priceMinor: price,
  variants: z.array(candidateVariant).max(100).default([]),
  // The source may suggest this relationship. No modifier is automatically applied.
  notes: boundedText(500).optional(),
}).strict();
const candidateCategory = z.object({
  id: importId,
  name: recognition,
  items: z.array(candidateDish).max(1000),
}).strict();
export const importCandidateSchema = z.object({
  schemaVersion: z.literal(1),
  importId,
  currency: z.string().regex(/^[A-Z]{3}$/),
  categories: z.array(candidateCategory).max(100),
}).strict().superRefine((doc, ctx) => {
  const ids = [
    ...doc.categories.flatMap(c => [c.id, ...c.items.flatMap(d => [d.id, ...d.variants.map(v => v.id)])]),
  ];
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "Candidate IDs must be unique" });
  if (Buffer.byteLength(JSON.stringify(doc), "utf8") > 500000)
    ctx.addIssue({ code: "custom", message: "Candidate exceeds the size limit" });
});
export type ImportCandidate = z.infer<typeof importCandidateSchema>;
export function parseImportCandidate(value: unknown): ImportCandidate {
  return importCandidateSchema.parse(value);
}
export const createImportSchema = z.object({
  id: importId,
  key: importId,
  targetMenuId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).nullable().default(null),
}).strict();
export const cancelImportSchema = z.object({ expectedRevision: z.number().int().positive() }).strict();
export const sourceUploadHeaders = z.object({
  id: importId,
  pageIndex: z.coerce.number().int().min(0).max(sourceLimit - 1),
}).strict();
