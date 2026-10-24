import { createHash, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { Transaction } from "@/db";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import type { InferenceResult, ProviderId } from "./contracts";
const uuid = z.string().uuid();
const entity = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
export const conversationInput = z
  .object({ organizationId: entity, outletId: entity, key: uuid })
  .strict();
export const turnInput = z
  .object({ key: uuid, prompt: z.string().trim().min(1).max(4000) })
  .strict();
export type Scope = { actor: Actor; organizationId: string; outletId: string };
export type StoredTurn = {
  id: string;
  conversationId: string;
  requestHash: string;
  prompt: string;
  status: "processing" | "completed" | "failed";
  answer: string | null;
  errorCode: string | null;
  evidence: unknown;
  createdAt: string;
};
const hash = (v: string) => createHash("sha256").update(v).digest("hex");
async function scoped<T>(s: Scope, work: (tx: Transaction) => Promise<T>): Promise<T> {
  return withActor(s.actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${s.outletId},true)`);
    const r = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.ai_scope(${s.organizationId},${s.outletId},${s.actor.userId}) as allowed`
    );
    if (!r.rows[0]?.allowed) throw new ForbiddenError("Assistant access denied");
    return work(tx);
  });
}
export async function assertAssistantScope(s: Scope) {
  await scoped(s, async () => true);
}
async function lockedConversation(tx: Transaction, s: Scope, id: string) {
  const r = await tx.execute(sql`select id from assistant_conversations where id=${id}
 and organization_id=${s.organizationId} and outlet_id=${s.outletId}
 and user_id=${s.actor.userId} for update`);
  if (!r.rows.length) throw new NotFoundError("Conversation");
}
export async function createConversation(s: Scope, key: string) {
  uuid.parse(key);
  return scoped(s, async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"ai-user:" + s.actor.userId},0))`
    );
    const old = await tx.execute<{
      id: string;
      organizationId: string;
      outletId: string;
      createdAt: Date;
    }>(sql`select id,organization_id as "organizationId",outlet_id as "outletId",created_at as "createdAt"
   from assistant_conversations where user_id=${s.actor.userId} and request_key=${key}::uuid limit 1`);
    if (old.rows.length) {
      const row = old.rows[0]!;
      if (row.organizationId !== s.organizationId || row.outletId !== s.outletId)
        throw new ConflictError("Request key reused");
      return row;
    }
    const count = await tx.execute<{ total: number }>(
      sql`select count(*)::int as total from assistant_conversations where user_id=${s.actor.userId} and created_at>=now()-interval '24 hours'`
    );
    if ((count.rows[0]?.total ?? 0) >= 12)
      throw new ForbiddenError("Daily assistant conversation limit reached");
    const r = await tx.execute<{
      id: string;
      organizationId: string;
      outletId: string;
      createdAt: Date;
    }>(sql`insert into assistant_conversations
  (id,organization_id,outlet_id,user_id,request_key) values(${randomUUID()},${s.organizationId},${s.outletId},${s.actor.userId},${key}::uuid)
  returning id,organization_id as "organizationId",outlet_id as "outletId",created_at as "createdAt"`);
    return r.rows[0]!;
  });
}
export async function listConversations(s: Scope) {
  return scoped(
    s,
    async (tx) =>
      (
        await tx.execute(sql`select id,created_at as "createdAt",updated_at as "updatedAt" from assistant_conversations
 where organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId}
 order by updated_at desc,id desc limit 20`)
      ).rows
  );
}
export async function conversationHistory(s: Scope, id: string) {
  uuid.parse(id);
  return scoped(s, async (tx) => {
    await lockedConversation(tx, s, id);
    const r =
      await tx.execute<StoredTurn>(sql`select id,conversation_id as "conversationId",request_hash as "requestHash",prompt,status,answer,error_code as "errorCode",evidence,created_at as "createdAt"
  from assistant_turns where conversation_id=${id} order by created_at desc,id desc limit 50`);
    return { conversationId: id, turns: r.rows.reverse() };
  });
}
export async function beginTurn(s: Scope, id: string, raw: unknown) {
  uuid.parse(id);
  const input = turnInput.parse(raw),
    digest = hash(input.prompt);
  return scoped(s, async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"ai-user:" + s.actor.userId},0))`
    );
    await lockedConversation(tx, s, id);
    // An interrupted external call is never replayed. Permit a NEW explicit key
    // only after the entire bounded two-call wall clock has elapsed.
    const stale = await tx.execute<{ id: string }>(
      sql`select id from assistant_turns where conversation_id=${id}
        and status='processing' and created_at < now()-interval '120 seconds' for update`
    );
    if (stale.rows.length) {
      const abandonedId = stale.rows[0]!.id;
      await tx.execute(sql`update assistant_attempts set status='uncertain',settled_at=now()
        where turn_id=${abandonedId} and status='started'`);
      await tx.execute(sql`update assistant_turns set status='failed',error_code='interrupted',
        completed_at=now() where id=${abandonedId} and status='processing'`);
    }
    const old = await tx.execute<StoredTurn>(
      sql`select id,conversation_id as "conversationId",request_hash as "requestHash",prompt,status,answer,error_code as "errorCode",evidence,created_at as "createdAt" from assistant_turns where conversation_id=${id} and client_key=${input.key}::uuid limit 1`
    );
    if (old.rows.length) {
      if (old.rows[0]!.requestHash !== digest)
        throw new ConflictError("Request key reused with different prompt");
      return { created: false, turn: old.rows[0]! };
    }
    const count = await tx.execute<{ total: number }>(
      sql`select count(*)::int as total from assistant_turns where user_id=${s.actor.userId} and created_at>=now()-interval '24 hours'`
    );
    if ((count.rows[0]?.total ?? 0) >= 20)
      throw new ForbiddenError("Daily assistant request limit reached");
    const active = await tx.execute(
      sql`select id from assistant_turns where conversation_id=${id} and status='processing' limit 1`
    );
    if (active.rows.length) throw new ConflictError("Previous request is still processing");
    const r = await tx.execute<StoredTurn>(sql`insert into assistant_turns
  (id,conversation_id,organization_id,outlet_id,user_id,client_key,request_hash,prompt)
  values (${randomUUID()},${id},${s.organizationId},${s.outletId},${s.actor.userId},${input.key}::uuid,${digest},${input.prompt})
  returning id,conversation_id as "conversationId",request_hash as "requestHash",prompt,status,answer,error_code as "errorCode",evidence,created_at as "createdAt"`);
    return { created: true, turn: r.rows[0]! };
  });
}
export async function reserveAttempt(
  s: Scope,
  turn: StoredTurn,
  round: 1 | 2,
  provider: ProviderId,
  model: string
) {
  if (!model || model.length > 128) throw new ValidationError("Invalid model");
  return scoped(s, async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"ai-org:" + s.organizationId},0))`
    );
    const r = await tx.execute<{
      status: string;
    }>(sql`select status from assistant_turns where id=${turn.id} and conversation_id=${turn.conversationId}
  and organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId} for update`);
    if (r.rows[0]?.status !== "processing") throw new ConflictError("Turn no longer processing");
    const budget = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.ai_reserve_org_budget(${s.organizationId},${s.outletId},${s.actor.userId}) as allowed`
    );
    if (!budget.rows[0]?.allowed)
      throw new ForbiddenError("Daily organization inference limit reached");
    const aid = randomUUID();
    await tx.execute(sql`insert into assistant_attempts (id,turn_id,conversation_id,organization_id,outlet_id,user_id,round,provider,model)
   values (${aid},${turn.id},${turn.conversationId},${s.organizationId},${s.outletId},${s.actor.userId},${round},${provider},${model})`);
    return aid;
  });
}
export async function settleAttempt(s: Scope, aid: string, result: InferenceResult | null) {
  uuid.parse(aid);
  await scoped(s, async (tx) => {
    const r =
      await tx.execute(sql`update assistant_attempts set status=${result ? "completed" : "uncertain"},
   input_tokens=${result?.usage.inputTokens ?? null},output_tokens=${result?.usage.outputTokens ?? null},settled_at=now()
   where id=${aid} and status='started' and organization_id=${s.organizationId}
   and outlet_id=${s.outletId} and user_id=${s.actor.userId} returning id`);
    if (r.rows.length !== 1) throw new ConflictError("Attempt already settled");
  });
}
export async function finishTurn(s: Scope, id: string, answer: string, evidence: unknown) {
  uuid.parse(id);
  if (answer.length > 16000 || JSON.stringify(evidence).length > 16000)
    throw new ValidationError("Assistant output too large");
  await scoped(s, async (tx) => {
    const r = await tx.execute(sql`update assistant_turns set status='completed',answer=${answer},
  evidence=${JSON.stringify(evidence)}::jsonb,completed_at=now() where id=${id} and status='processing'
  and organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId} returning id`);
    if (r.rows.length !== 1) throw new ConflictError("Turn already settled");
    await tx.execute(sql`update assistant_conversations set updated_at=now()
  where id=(select conversation_id from assistant_turns where id=${id})`);
  });
}
export async function failTurn(s: Scope, id: string, code: string) {
  uuid.parse(id);
  if (!/^[a-z_]{1,40}$/.test(code)) code = "processing_failed";
  await scoped(s, async (tx) => {
    await tx.execute(
      sql`update assistant_attempts set status='uncertain',settled_at=now() where turn_id=${id} and status='started'`
    );
    await tx.execute(sql`update assistant_turns set status='failed',answer=null,error_code=${code},completed_at=now()
  where id=${id} and status='processing' and organization_id=${s.organizationId}
  and outlet_id=${s.outletId} and user_id=${s.actor.userId}`);
  });
}
