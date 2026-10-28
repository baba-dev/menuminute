import { createHash, createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { createRestaurant, createRestaurantSchema } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import { sendAuthEmail } from "@/lib/auth-email";
import { AppError, ConflictError, ValidationError } from "@/lib/errors";
import { domainError } from "@/modules/organizations/service";
export const onboardingDraftSchema = createRestaurantSchema.partial().strict();
const invitationInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.trim().toLowerCase()),
    role: z.enum(["member", "admin"]),
    key: z.uuid(),
  })
  .strict();
const tokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
function stableJson(input: unknown): string {
  const ordered = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(ordered)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, value]) => [key, ordered(value)])
          )
        : v;
  return JSON.stringify(ordered(input));
}
const operationId = (user: string, key: string) =>
  createHash("sha256")
    .update(user + ":" + key)
    .digest("hex");
type Progress = {
  operation_key: string;
  draft: Record<string, unknown>;
  status: "draft" | "provisioning" | "completed";
  outlet_id: string | null;
};
export async function onboardingState(actor: Actor) {
  return withActor(actor, async (tx) => {
    const result = await tx.execute<Progress>(sql`select operation_key,draft,status,outlet_id
      from onboarding_progress where user_id=${actor.userId}`);
    const state = result.rows[0];
    if (!state) return { key: null, draft: {}, status: "draft" as const, outletId: null };
    const expected = operationId(actor.userId, state.operation_key);
    const visible = await tx.execute<{ id: string }>(
      sql`select id from restaurants where id=${expected} limit 1`
    );
    if (state.status === "completed" && !visible.rows[0]) {
      return {
        key: state.operation_key,
        draft: {},
        status: "inaccessible" as const,
        outletId: null,
      };
    }
    if (visible.rows[0] && state.status === "completed" && Object.keys(state.draft).length) {
      await tx.execute(
        sql`update onboarding_progress set draft='{}'::jsonb,updated_at=now() where user_id=${actor.userId}`
      );
    }
    if (visible.rows[0] && state.status !== "completed") {
      await tx.execute(sql`update onboarding_progress set status='completed',outlet_id=${expected},
        draft='{}'::jsonb,updated_at=now() where user_id=${actor.userId}`);
    }
    return {
      key: state.operation_key,
      draft: visible.rows[0] ? {} : state.draft,
      status: visible.rows[0] ? ("completed" as const) : state.status,
      outletId: visible.rows[0] ? expected : state.outlet_id,
    };
  });
}
export async function saveOnboarding(actor: Actor, input: unknown) {
  const draft = onboardingDraftSchema.parse(input);
  return withActor(actor, async (tx) => {
    const current = await tx.execute<Progress>(
      sql`select operation_key,draft,status,outlet_id from onboarding_progress
        where user_id=${actor.userId} for update`
    );
    const original = current.rows[0];
    if (original?.status === "completed")
      throw new ConflictError("Outlet already created. Refresh to continue.");
    if (original?.status === "provisioning") {
      if (stableJson(original.draft) !== stableJson(draft))
        throw new ConflictError(
          "A previous operation is in progress. Resume with the saved settings."
        );
      // The first response may have been lost. Reuse the same durable key, then
      // reconcile/retry the idempotent provisioning operation without a new outlet.
      return {
        key: original.operation_key,
        draft: original.draft,
        status: "provisioning" as const,
        outletId: null,
      };
    }
    const key =
      original && stableJson(original.draft) === stableJson(draft)
        ? original.operation_key
        : crypto.randomUUID();
    await tx.execute(sql`insert into onboarding_progress(user_id,operation_key,draft)
      values(${actor.userId},${key},${JSON.stringify(draft)}::jsonb)
      on conflict(user_id) do update set operation_key=excluded.operation_key,
      draft=excluded.draft,status='draft',outlet_id=null,updated_at=now()`);
    return { key, draft, status: "draft" as const, outletId: null };
  });
}
export async function provisionOnboarding(actor: Actor) {
  const state = await onboardingState(actor);
  if (state.status === "completed" && state.outletId)
    return { outletId: state.outletId, status: "completed" as const };
  if (state.status === "inaccessible")
    throw new ConflictError("Previously created outlet is unavailable. Contact its administrator.");
  if (!state.key) throw new ValidationError("Save your outlet settings first.");
  const input = createRestaurantSchema.safeParse(state.draft);
  if (!input.success) throw new ValidationError("Complete the required outlet settings.");
  await withActor(actor, async (tx) => {
    const claimed = await tx.execute<{ operation_key: string }>(
      sql`update onboarding_progress set status='provisioning',updated_at=now()
        where user_id=${actor.userId} and operation_key=${state.key}
          and status in ('draft','provisioning') returning operation_key`
    );
    if (!claimed.rows[0]) {
      throw new ConflictError("Outlet settings changed. Refresh and resume the latest draft.");
    }
  });
  try {
    const outlet = await createRestaurant(actor.userId, input.data, state.key);
    await withActor(actor, async (tx) =>
      tx.execute(sql`update onboarding_progress set status='completed',outlet_id=${outlet.id},
        draft='{}'::jsonb,updated_at=now() where user_id=${actor.userId} and operation_key=${state.key}`)
    );
    return { outletId: outlet.id, status: "completed" as const };
  } catch (error) {
    domainError(error);
  }
}
function invitationToken(
  organizationId: string,
  input: z.output<typeof invitationInput>,
  actor: Actor
) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(JSON.stringify([organizationId, actor.userId, input.key, input.email, input.role]))
    .digest("hex");
}
export async function inviteMember(actor: Actor, orgId: string, raw: unknown) {
  const input = invitationInput.parse(raw);
  const token = invitationToken(orgId, input, actor);
  const hash = createHash("sha256").update(token).digest("hex");
  let result;
  try {
    result = await withActor(actor, (tx) =>
      tx.execute<{ invite_id: string; expires_at: Date }>(
        sql`select invite_id,expires_at from app_private.issue_invitation(${orgId},${input.email},
        ${input.role},${input.key},${hash})`
      )
    );
  } catch (e) {
    domainError(e);
  }
  const url = new URL("/invite/" + token, env.APP_URL).toString();
  try {
    await sendAuthEmail(input.email, "Invitation to MenuMinute", url);
  } catch {
    throw new AppError(
      "The invitation is saved, but delivery was not confirmed. Retry with the same details.",
      "INVITATION_DELIVERY",
      503
    );
  }
  return { id: result.rows[0]!.invite_id, expiresAt: result.rows[0]!.expires_at };
}
export async function invitationPreview(actor: Actor, rawToken: string) {
  const hash = createHash("sha256").update(tokenSchema.parse(rawToken)).digest("hex");
  const value = await withActor(actor, (tx) =>
    tx.execute<{
      result: {
        organization: string;
        email: string;
        role: string;
        status: string;
        expiresAt: string;
      } | null;
    }>(sql`select app_private.invitation_preview(${hash}) as result`)
  );
  if (!value.rows[0]?.result)
    throw new ValidationError("Invitation expired or addressed to a different account.");
  return value.rows[0].result;
}
export async function acceptInvitation(actor: Actor, rawToken: string) {
  const hash = createHash("sha256").update(tokenSchema.parse(rawToken)).digest("hex");
  let result;
  try {
    result = await withActor(actor, (tx) =>
      tx.execute<{ result: { organizationId: string; memberId: string } }>(
        sql`select app_private.accept_invitation(${hash}) as result`
      )
    );
  } catch (e) {
    domainError(e);
  }
  return result.rows[0]!.result;
}
export async function listInvitations(actor: Actor, orgId: string) {
  const result = await withActor(actor, (tx) =>
    tx.execute<{
      result: Array<{ id: string; email: string; role: string; status: string; expiresAt: string }>;
    }>(sql`select app_private.list_invitations(${orgId}) as result`)
  );
  return result.rows[0]?.result ?? [];
}
export async function revokeInvitation(actor: Actor, orgId: string, inviteId: string) {
  z.uuid().parse(inviteId);
  try {
    await withActor(actor, (tx) =>
      tx.execute(sql`select app_private.revoke_invitation(${orgId},${inviteId})`)
    );
  } catch (e) {
    domainError(e);
  }
}
