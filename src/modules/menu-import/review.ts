import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { domainError } from "@/modules/organizations/service";
import { ValidationError } from "@/lib/errors";
import { menuDocumentSchema, type MenuDocument } from "@/modules/menu-product/contracts";
import { importId, parseImportCandidate, type ImportCandidate } from "./contracts";
import { importDetail } from "./service";

const saveSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    candidateRevision: z.number().int().positive(),
    document: menuDocumentSchema,
    confirmedIds: z.array(importId).max(120000),
    finalize: z.boolean(),
  })
  .strict();
const applySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    menuId: importId,
    expectedMenuRevision: z.number().int().nonnegative(),
  })
  .strict();
export function candidateIdentity(doc: ImportCandidate) {
  return doc.categories.flatMap((c) => [
    c.id,
    ...c.items.flatMap((i) => [i.id, ...i.variants.map((v) => v.id)]),
  ]);
}
export function initialReviewDocument(candidate: ImportCandidate): MenuDocument {
  return menuDocumentSchema.parse({
    name: "Imported menu draft",
    currency: candidate.currency,
    categories: candidate.categories.map((c) => ({
      id: c.id,
      name: c.name.value?.slice(0, 100) || "Review category",
      description: "",
      items: c.items.map((d) => ({
        id: d.id,
        name: d.name.value?.slice(0, 100) || "Review dish",
        description: d.description?.value ?? "",
        priceMinor: d.priceMinor.value ?? 0,
        variants: d.variants.map((v) => ({
          id: v.id,
          name: v.name.value?.slice(0, 100) || "Review variant",
          priceMinor: v.priceMinor.value ?? 0,
        })),
        dietary: [],
        mediaId: null,
        soldOut: false,
      })),
    })),
  });
}
/** Source linked identity and object hierarchy are retained through every human correction. */
export function assertReviewStructure(
  candidate: ImportCandidate,
  doc: MenuDocument,
  confirmed: string[],
  finalize: boolean
) {
  const source = candidateIdentity(candidate);
  const target = doc.categories.flatMap((c) => [
    c.id,
    ...c.items.flatMap((i) => [i.id, ...i.variants.map((v) => v.id)]),
  ]);
  if (
    source.length !== target.length ||
    new Set(source).size !== source.length ||
    source.some((x) => !target.includes(x)) ||
    new Set(confirmed).size !== confirmed.length ||
    confirmed.some((x) => !source.includes(x)) ||
    doc.currency !== candidate.currency ||
    doc.categories.length !== candidate.categories.length ||
    doc.categories.some(
      (c, ci) =>
        c.id !== candidate.categories[ci]?.id ||
        c.archived ||
        c.items.length !== candidate.categories[ci]?.items.length ||
        c.items.some(
          (d, di) =>
            d.id !== candidate.categories[ci]?.items[di]?.id ||
            d.archived ||
            d.soldOut ||
            d.mediaId !== null ||
            d.dietary.length !== 0 ||
            d.variants.length !== candidate.categories[ci]?.items[di]?.variants.length ||
            d.variants.some(
              (v, vi) => v.id !== candidate.categories[ci]?.items[di]?.variants[vi]?.id
            )
        )
    )
  )
    throw new ValidationError(
      "Review structure must retain source-linked categories, dishes and variants"
    );
  if (finalize && confirmed.length !== source.length)
    throw new ValidationError(
      "Confirm every category, dish and variant against its source photograph"
    );
  if (
    finalize &&
    (!doc.categories.some((c) => c.items.length) ||
      doc.categories.some(
        (c) =>
          !c.name.trim() ||
          c.items.some((d) => !d.name.trim() || d.variants.some((v) => !v.name.trim()))
      ))
  )
    throw new ValidationError("Every included category, dish, variant and price needs review");
}
export async function saveReview(actor: Actor, outletId: string, rawId: string, raw: unknown) {
  const id = importId.parse(rawId),
    input = saveSchema.parse(raw);
  const current = await importDetail(actor, outletId, id);
  if (!current.candidate || current.candidate.revision !== input.candidateRevision)
    throw new ValidationError("The recognition result changed. Reload this review.");
  const candidate = parseImportCandidate(current.candidate.document);
  if (candidate.importId !== id || current.currency !== candidate.currency)
    throw new ValidationError("Import scope changed");
  assertReviewStructure(candidate, input.document, input.confirmedIds, input.finalize);
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: { id: string; revision: number; status: string } }>(
            sql`select app_private.import_review_save(${outletId},${id},${input.expectedRevision},${input.candidateRevision},${JSON.stringify(input.document)}::jsonb,${JSON.stringify(input.confirmedIds)}::jsonb,${input.finalize}) as result`
          )
        ).rows[0]!.result
    );
  } catch (err) {
    domainError(err);
  }
}
export async function applyReview(actor: Actor, outletId: string, rawId: string, raw: unknown) {
  const id = importId.parse(rawId),
    input = applySchema.parse(raw);
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{
            result: {
              id: string;
              status: string;
              revision: number;
              menuId: string;
              menuRevision: number;
              duplicate: boolean;
            };
          }>(
            sql`select app_private.import_apply(${outletId},${id},${input.expectedRevision},${input.menuId},${input.expectedMenuRevision}) as result`
          )
        ).rows[0]!.result
    );
  } catch (err) {
    domainError(err);
  }
}
