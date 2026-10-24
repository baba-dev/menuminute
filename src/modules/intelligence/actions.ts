import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor } from "@/modules/tenancy/service";
import type { Transaction } from "@/db";
import { ForbiddenError, ConflictError, ValidationError, NotFoundError } from "@/lib/errors";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import { conversationInput, assertAssistantScope, type Scope } from "./store";

const uuid=z.string().uuid();
const identity=z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const proposalInput=conversationInput.omit({key:true}).extend({
 conversationId:uuid,menuId:identity,dishId:identity,desiredSoldOut:z.boolean(),key:uuid
}).strict();
export const decisionInput=conversationInput.omit({key:true}).extend({
 key:uuid,decision:z.enum(["confirm","reject"])
}).strict();
const proposalResponse=z.object({
 id:uuid,status:z.enum(["pending","confirmed","rejected","stale"]),menuId:identity,
 menuName:z.string(),dishId:identity,dishName:z.string(),beforeSoldOut:z.boolean(),
 desiredSoldOut:z.boolean(),expectedRevision:z.number().int(),expiresAt:z.coerce.date(),
 result:z.unknown().nullable()
});
const receiptResponse=z.object({
 id:uuid,status:z.enum(["confirmed","rejected","stale"]),message:z.string().optional(),
 menuId:identity.optional(),dishId:identity.optional(),dishName:z.string().optional(),
 soldOut:z.boolean().optional(),result:z.unknown().optional()
});
function translate(error:unknown):never{
 const inner=error instanceof Error && error.cause ? error.cause:error;
 const code=typeof inner==="object"&&inner!==null&&"code" in inner?inner.code:undefined;
 if(code==="42501")throw new ForbiddenError("Assistant action access changed");
 if(code==="40001"||code==="23505")throw new ConflictError("Proposal is stale, expired, or already decided");
 if(code==="22023"||code==="23514"||code==="23503")throw new ValidationError("Menu or dish is not eligible for this action");
 throw error;
}
async function actionTx<T>(s:Scope,work:(tx:Transaction)=>Promise<T>){
 await assertAssistantScope(s);
 try{
  return await withActor(s.actor,async tx=>{
   await tx.execute(sql`select set_config('app.outlet_id',${s.outletId},true)`);
   const allowed=await tx.execute<{allowed:boolean}>(sql`select app_private.can_outlet(${s.outletId},'menu.write') as allowed`);
   if(!allowed.rows[0]?.allowed)throw new ForbiddenError("Menu write permission required");
   return work(tx);
  });
 }catch(error){translate(error);}
}
/** This is a form-created request by the authenticated human, never a provider tool call. */
export async function proposeAvailability(s:Scope,input:unknown){
 const p=proposalInput.parse(input);
 if(p.organizationId!==s.organizationId||p.outletId!==s.outletId)throw new ForbiddenError();
 return actionTx(s,async tx=>{
  const result=await tx.execute<{result:unknown}>(sql`select app_private.ai_propose_availability(
   ${s.organizationId},${s.outletId},${p.conversationId},${p.menuId},${p.dishId},${p.desiredSoldOut},${p.key}::uuid) as result`);
  return proposalResponse.parse(result.rows[0]?.result);
 });
}
export async function decideAvailability(s:Scope,proposalId:string,input:unknown){
 uuid.parse(proposalId);
 const p=decisionInput.parse(input);
 if(p.organizationId!==s.organizationId||p.outletId!==s.outletId)throw new ForbiddenError();
 return actionTx(s,async tx=>{
  const result=await tx.execute<{result:unknown}>(sql`select app_private.ai_decide_action(
  ${s.organizationId},${s.outletId},${proposalId}::uuid,${p.key}::uuid,${p.decision}) as result`);
  return receiptResponse.parse(result.rows[0]?.result);
 });
}
export async function actionHistory(s:Scope,conversationId:string){
 uuid.parse(conversationId);
 return actionTx(s,async tx=>{
  const owner=await tx.execute(sql`select id from assistant_conversations where id=${conversationId}
   and organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId}`);
  if(!owner.rows.length)throw new NotFoundError("Conversation");
  const rows=await tx.execute(sql`select id,status,menu_id as "menuId",menu_name as "menuName",
   dish_id as "dishId",dish_name as "dishName",previous_sold_out as "beforeSoldOut",
   desired_sold_out as "desiredSoldOut",expected_revision as "expectedRevision",
   expires_at as "expiresAt",created_at as "createdAt",result
   from assistant_action_proposals where conversation_id=${conversationId}
   order by created_at desc,id desc limit 20`);
  return rows.rows;
 });
}
/** Return only published, assigned and editable menu dishes; no private draft text leaves this endpoint. */
export async function availabilityOptions(s:Scope){
 return actionTx(s,async tx=>{
  const rows=await tx.execute<{
    id:string;revision:number;name:string;document:unknown;overrides:unknown;
  }>(sql`select m.id,m.revision,m.document->>'name' as name,rel.document,
   coalesce((select jsonb_agg(jsonb_build_object('dishId',o.dish_id,'soldOut',o.sold_out))
     from menu_overrides o where o.menu_id=m.id and o.outlet_id=${s.outletId}), '[]'::jsonb) as overrides
   from menus m join menu_assignments a on a.menu_id=m.id
     and a.outlet_id=${s.outletId} and a.organization_id=${s.organizationId}
   join menu_releases rel on rel.menu_id=m.id and rel.revision=m.published_revision
   where m.organization_id=${s.organizationId} and not m.archived
     and app_private.menu_access(m.id,'menu.write')
   order by m.updated_at desc,m.id desc limit 12`);
  return rows.rows.map(row=>{
   const d=menuDocumentSchema.safeParse(row.document);
   if(!d.success)return null;
   const overrides=z.array(z.object({dishId:identity,soldOut:z.boolean().nullable()})).safeParse(row.overrides);
   if(!overrides.success)return null;
   const effective=new Map(overrides.data.map(o=>[o.dishId,o.soldOut]));
   return {id:row.id,name:row.name,revision:row.revision,
    items:d.data.categories.filter(c=>!c.archived).flatMap(c=>c.items.filter(i=>!i.archived)
     .map(i=>({id:i.id,name:i.name,category:c.name,soldOut:effective.get(i.id)??i.soldOut})))
     .slice(0,80)};
  }).filter((m):m is NonNullable<typeof m>=>m!==null);
 });
}
