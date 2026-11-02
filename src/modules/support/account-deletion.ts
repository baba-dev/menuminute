import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";

export const deletionRequestInput = z
  .object({
    organizationId: z.string().min(1).max(128),
    outletId: z.string().min(1).max(128),
    confirm: z.literal(true),
  })
  .strict();

export type AccountDeletionRequest = {
  ticketNumber: number;
  createdAt: string;
  dueAt: string;
  cancelledAt: string | null;
  canCancel: boolean;
};

function translate(error: unknown): never {
  const nested = error instanceof Error && error.cause ? error.cause : error;
  const code =
    typeof nested === "object" && nested !== null && "code" in nested ? nested.code : undefined;
  if (code === "42501")
    throw new ForbiddenError("Account deletion is unavailable for this account.");
  if (code === "22023")
    throw new ValidationError(
      nested instanceof Error ? nested.message : "Unable to update the deletion request."
    );
  if (code === "23505") throw new ConflictError("Your request changed. Refresh and try again.");
  throw error;
}

async function run<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    translate(error);
  }
}

export async function getAccountDeletionRequest(
  actor: Actor
): Promise<AccountDeletionRequest | null> {
  return run(() =>
    withActor(actor, async (tx) => {
      const result = await tx.execute<{
        ticketNumber: number;
        createdAt: Date | string;
        dueAt: Date | string;
        cancelledAt: Date | string | null;
        canCancel: boolean;
      }>(sql`
        SELECT t.ticket_number AS "ticketNumber",r.created_at AS "createdAt",
          r.due_at AS "dueAt",r.cancelled_at AS "cancelledAt",
          (r.cancelled_at IS NULL AND now()<r.due_at) AS "canCancel"
        FROM account_deletion_requests r
        JOIN support_tickets t ON t.id=r.ticket_id
        WHERE r.user_id=${actor.userId}
        ORDER BY r.created_at DESC,r.id DESC LIMIT 1
      `);
      const row = result.rows[0];
      if (!row) return null;
      return {
        ticketNumber: row.ticketNumber,
        createdAt: new Date(row.createdAt).toISOString(),
        dueAt: new Date(row.dueAt).toISOString(),
        cancelledAt: row.cancelledAt ? new Date(row.cancelledAt).toISOString() : null,
        canCancel: row.canCancel,
      };
    })
  );
}

export async function requestAccountDeletion(actor: Actor, raw: unknown) {
  const input = deletionRequestInput.parse(raw);
  return run(() =>
    withActor(actor, async (tx) => {
      const result = await tx.execute<{
        result: Omit<AccountDeletionRequest, "canCancel">;
      }>(
        sql`select app_private.request_account_deletion(${input.organizationId},${input.outletId}) as result`
      );
      return result.rows[0]!.result;
    })
  );
}

export async function cancelAccountDeletion(actor: Actor) {
  return run(() =>
    withActor(actor, async (tx) => {
      const result = await tx.execute<{
        result: Omit<AccountDeletionRequest, "canCancel">;
      }>(sql`select app_private.cancel_account_deletion() as result`);
      return result.rows[0]!.result;
    })
  );
}
