import { and, desc, eq, sql } from "drizzle-orm";
import {
  menuImportCandidates,
  menuImports,
  menuImportSources,
  menuImportReviews,
} from "@/db/schema";
import { withActor, withOutlet, type Actor } from "@/modules/tenancy/service";
import { NotFoundError } from "@/lib/errors";
import { domainError } from "@/modules/organizations/service";
import { createImportSchema, importId, sourceUploadHeaders, cancelImportSchema } from "./contracts";
import { digest, getPrivateSource, normalizeSource, putPrivateSource } from "./storage";

type CommandResult = {
  id: string;
  status: string;
  revision?: number;
  duplicate?: boolean;
  storageKey?: string;
};
export async function createImport(actor: Actor, outletId: string, input: unknown) {
  const command = createImportSchema.parse(input);
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: CommandResult }>(
            sql`select app_private.import_create(${outletId},${command.id},${command.key},${command.targetMenuId}) as result`
          )
        ).rows[0]!.result
    );
  } catch (error) {
    domainError(error);
  }
}
export async function listImports(actor: Actor, outletId: string) {
  return withOutlet(actor, outletId, "menu.write", async (tx) =>
    tx
      .select({
        id: menuImports.id,
        currency: menuImports.currency,
        targetMenuId: menuImports.targetMenuId,
        status: menuImports.status,
        revision: menuImports.revision,
        createdAt: menuImports.createdAt,
        updatedAt: menuImports.updatedAt,
      })
      .from(menuImports)
      .where(eq(menuImports.outletId, outletId))
      .orderBy(desc(menuImports.createdAt))
      .limit(25)
  );
}
export async function importDetail(actor: Actor, outletId: string, rawId: string) {
  const id = importId.parse(rawId);
  return withOutlet(actor, outletId, "menu.write", async (tx) => {
    const row = (
      await tx
        .select({
          id: menuImports.id,
          status: menuImports.status,
          revision: menuImports.revision,
          currency: menuImports.currency,
          targetMenuId: menuImports.targetMenuId,
          createdAt: menuImports.createdAt,
          updatedAt: menuImports.updatedAt,
        })
        .from(menuImports)
        .where(and(eq(menuImports.id, id), eq(menuImports.outletId, outletId)))
    )[0];
    if (!row) throw new NotFoundError("Menu import");
    const sources = await tx
      .select({
        id: menuImportSources.id,
        pageIndex: menuImportSources.pageIndex,
        status: menuImportSources.status,
        width: menuImportSources.width,
        height: menuImportSources.height,
        createdAt: menuImportSources.createdAt,
      })
      .from(menuImportSources)
      .where(eq(menuImportSources.importId, id))
      .orderBy(menuImportSources.pageIndex);
    const latest =
      (
        await tx
          .select({
            revision: menuImportCandidates.revision,
            schemaVersion: menuImportCandidates.schemaVersion,
            document: menuImportCandidates.document,
          })
          .from(menuImportCandidates)
          .where(eq(menuImportCandidates.importId, id))
          .orderBy(desc(menuImportCandidates.revision))
          .limit(1)
      )[0] ?? null;
    const review =
      (
        await tx
          .select({
            document: menuImportReviews.document,
            confirmedIds: menuImportReviews.confirmedIds,
            state: menuImportReviews.state,
            baseCandidateRevision: menuImportReviews.baseCandidateRevision,
            reviewRevision: menuImportReviews.reviewRevision,
            appliedMenuId: menuImportReviews.appliedMenuId,
            appliedMenuRevision: menuImportReviews.appliedMenuRevision,
          })
          .from(menuImportReviews)
          .where(eq(menuImportReviews.importId, id))
      )[0] ?? null;
    return { ...row, sources, candidate: latest, review };
  });
}
/** Only fully authorized editors may obtain private bytes; recheck after the storage read. */
export async function readImportSource(
  actor: Actor,
  outletId: string,
  rawImportId: string,
  rawSourceId: string
) {
  const id = importId.parse(rawImportId),
    sourceId = importId.parse(rawSourceId);
  const scopedRead = () =>
    withOutlet(actor, outletId, "menu.write", async (tx) => {
      const row = (
        await tx
          .select({ key: menuImportSources.storageKey, status: menuImportSources.status })
          .from(menuImportSources)
          .where(
            and(
              eq(menuImportSources.importId, id),
              eq(menuImportSources.id, sourceId),
              eq(menuImportSources.outletId, outletId)
            )
          )
      )[0];
      if (!row || row.status !== "ready") throw new NotFoundError("Import source");
      return row.key;
    });
  const key = await scopedRead();
  const bytes = await getPrivateSource(key);
  if ((await scopedRead()) !== key) throw new NotFoundError("Import source");
  return bytes;
}
export async function addImportSource(
  actor: Actor,
  outletId: string,
  rawImportId: string,
  rawHeaders: unknown,
  input: Buffer
) {
  const id = importId.parse(rawImportId);
  const { id: sourceId, pageIndex } = sourceUploadHeaders.parse(rawHeaders);
  await withOutlet(actor, outletId, "menu.write", async () => true);
  const originalSha = digest(input);
  const normalized = await normalizeSource(input);
  let reservation: CommandResult;
  try {
    reservation = await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: CommandResult }>(
            sql`select app_private.import_source_reserve(${outletId},${id},${sourceId},${pageIndex},${originalSha},${input.length}) as result`
          )
        ).rows[0]!.result
    );
  } catch (error) {
    domainError(error);
  }
  if (reservation.status === "ready") return { id: sourceId, status: "ready", duplicate: true };
  if (!reservation.storageKey) throw new Error("Private source reservation missing");
  await putPrivateSource(reservation.storageKey, normalized.bytes);
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: CommandResult }>(
            sql`select app_private.import_source_complete(${outletId},${id},${sourceId},
          ${digest(normalized.bytes)},${normalized.bytes.length},${normalized.width},${normalized.height}) as result`
          )
        ).rows[0]!.result
    );
  } catch (error) {
    domainError(error);
  }
}
export async function cancelImport(
  actor: Actor,
  outletId: string,
  rawId: string,
  rawCommand: unknown
) {
  const id = importId.parse(rawId),
    command = cancelImportSchema.parse(rawCommand);
  try {
    return await withActor(
      actor,
      async (tx) =>
        (
          await tx.execute<{ result: CommandResult }>(
            sql`select app_private.import_cancel(${outletId},${id},${command.expectedRevision}) as result`
          )
        ).rows[0]!.result
    );
  } catch (error) {
    domainError(error);
  }
}
