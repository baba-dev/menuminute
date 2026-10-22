import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { posContext } from "@/modules/pos/service";
import { ConflictError, ForbiddenError, ValidationError } from "@/lib/errors";

const key = z.string().uuid();
const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const amount = z.string().regex(/^(0|[1-9][0-9]{0,9})$/);
const positive = amount.refine((v) => BigInt(v) > 0n, "Positive minor-unit amount required");
const reason = z.string().trim().min(5).max(200);
const customer = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  address: z.string().trim().min(5).max(500).optional(),
  taxRegistration: z.string().trim().min(3).max(64).optional(),
}).strict();
const commands = z.discriminatedUnion("action", [
 z.object({action:z.literal("profile"), key, data:z.object({
  mode:z.enum(["non_registered","classified"]), expectedRevision:z.number().int().nonnegative(),
  inclusive:z.boolean(), taxLabel:z.string().trim().min(2).max(40),
  classes:z.array(z.object({dishId:id,classification:z.string().trim().min(1).max(32),
   rateBps:z.number().int().min(0).max(10000)}).strict()).max(1000),
 }).strict()}).strict(),
 z.object({action:z.literal("freeze"),key,data:z.object({saleId:id,expectedTotalMinor:amount,
   expectedTaxRevision:z.number().int().positive(),customer:customer.default({})}).strict()}).strict(),
 z.object({action:z.literal("open_shift"),key,data:z.object({registerName:z.string().trim().min(2).max(40),
   openingMinor:amount}).strict()}).strict(),
 z.object({action:z.literal("cash_move"),key,data:z.object({shiftId:id,direction:z.enum(["in","out"]),
   amountMinor:positive,reason}).strict()}).strict(),
 z.object({action:z.literal("tender"),key,data:z.object({saleId:id,shiftId:id,
   method:z.enum(["cash","card_external","upi_external","bank_external"]),amountMinor:positive,
   tenderedMinor:positive,reference:z.string().trim().max(80).nullable()}).strict()}).strict(),
 z.object({action:z.literal("close_shift"),key,data:z.object({shiftId:id,countedMinor:amount}).strict()}).strict(),
 z.object({action:z.literal("issue"),key,data:z.object({saleId:id}).strict()}).strict(),
 z.object({action:z.literal("refund"),key,data:z.object({saleId:id,shiftId:id,reason}).strict()}).strict(),
]);
export type FinanceCommand = z.infer<typeof commands>;
export type FinanceContext = {paymentsEnabled:boolean;documentsEnabled:boolean;fiscalApproved:boolean;
  taxProfile:null|{mode:"non_registered"|"classified";inclusive:boolean;taxLabel:string;revision:number;
   classes:Array<{dishId:string;classification:string;rateBps:number}>};
  canManage:boolean;canCollect:boolean;canRefund:boolean;canIssue:boolean};
export type LedgerRow = {saleId:string;orderId:string;currency:string;subtotalMinor:string;
 totalMinor:string|null;taxMinor:string|null;paidMinor:string;refundedMinor:string;
 documentNumber:string|null;createdAt:string};
export type ShiftRow = {id:string;registerName:string;state:"open"|"closed";actorId:string;
 openingMinor:string;expectedMinor:string|null;countedMinor:string|null;currency:string;openedAt:string;closedAt:string|null;
 cashTakenMinor:string;cashRefundMinor:string};
export type Detail = {saleId:string;orderId:string;currency:string;subtotalMinor:string;
 bill:null|{totalMinor:string;subtotalMinor:string;taxMinor:string;taxableBaseMinor:string;taxMode:string;taxProfileRevision:number;
 seller:Record<string,string|null>;customer:Record<string,string>;lines:Array<Record<string,string|number|null>>};
 tenders:Array<{id:string;method:string;amountMinor:string;changeMinor:string;reference:string|null;evidence:string;shiftId:string;createdAt:string}>;
 refunds:Array<{tenderId:string;amountMinor:string;reason:string;createdAt:string}>;
 documents:Array<{id:string;number:string;kind:string;sourceDocumentId:string|null;issuedAt:string}>};
export type DocumentDetail = {id:string;number:string;kind:string;issuedAt:string;sourceDocumentId:string|null;
 snapshot:{bill?:Detail["bill"];settlement?:Array<{method:string;amountMinor:string;reference:string|null;evidence:string}>;
  orderId?:string;legalStatus:string;reverses?:string;reason?:string;totalMinor?:string}};
const queryTypes = z.discriminatedUnion("view",[
 z.object({view:z.literal("context")}).strict(),
 z.object({view:z.literal("ledger")}).strict(),
 z.object({view:z.literal("shifts")}).strict(),
 z.object({view:z.literal("reconcile")}).strict(),
 z.object({view:z.literal("sale"),id}).strict(),
 z.object({view:z.literal("document"),id}).strict(),
 z.object({view:z.literal("preview"),id}).strict(),
]);
export type FinanceView = z.infer<typeof queryTypes>;
function dbError(error:unknown):never {
 const e=error instanceof Error && error.cause?error.cause:error;
 const code=e && typeof e==="object" && "code" in e ? String(e.code):"";
 if(code==="42501")throw new ForbiddenError("Finance permission or operator activation required.");
 if(code==="40001"||code==="23505")throw new ConflictError("This financial record or request changed. Refresh and retry.");
 if(["22023","22P02","23503","23514","23502","22003"].includes(code))
  throw new ValidationError("Invalid financial state, tax classification or command.");
 throw error;
}
async function run<T>(actor:Actor,outletId:string,statement:ReturnType<typeof sql>):Promise<T>{
 try {
 return await withActor(actor,async(tx)=>{
  await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
  const r=await tx.execute<{result:T}>(statement);
  return r.rows[0]!.result;
 });
 }catch(error){dbError(error)}
}
export async function financeRead(actor:Actor,organizationId:string,outletId:string,raw:unknown) {
 const input=queryTypes.parse(raw);
 await posContext(actor,organizationId,outletId);
 switch(input.view){
  case "context": return run<FinanceContext>(actor,outletId,sql`select app_private.pos_finance_context(${outletId}) as result`);
  case "ledger": return run<LedgerRow[]>(actor,outletId,sql`select app_private.pos_ledger(${outletId}) as result`);
  case "shifts": return run<ShiftRow[]>(actor,outletId,sql`select app_private.pos_shift_list(${outletId}) as result`);
  case "reconcile": return run<{checkedAt:string;outletId:string;anomalies:{saleId:string;reason:string}[]}>(actor,outletId,sql`select app_private.pos_reconciliation(${outletId}) as result`);
  case "sale": return run<Detail>(actor,outletId,sql`select app_private.pos_sale_detail(${outletId},${input.id}) as result`);
  case "document": return run<DocumentDetail>(actor,outletId,sql`select app_private.pos_document_detail(${outletId},${input.id}) as result`);
  case "preview": return run<Record<string,unknown>>(actor,outletId,sql`select app_private.pos_preview(${outletId},${input.id}) as result`);
 }
}
/** Command hashes exclude the idempotency key. The database holds one immutable result per outlet+key. */
export async function financeCommand(actor:Actor,organizationId:string,outletId:string,raw:unknown){
 const cmd=commands.parse(raw);
 await posContext(actor,organizationId,outletId);
 if(cmd.action==="profile"){
  if(cmd.data.mode==="non_registered" && cmd.data.classes.length)throw new ValidationError("Non-registered profile cannot classify taxable items.");
  if(cmd.data.mode==="classified" && !cmd.data.classes.length)throw new ValidationError("Classify every sale dish before billing.");
  if(new Set(cmd.data.classes.map(c=>c.dishId)).size!==cmd.data.classes.length)throw new ValidationError("Duplicate dish tax classification.");
 }
 if(cmd.action==="tender"){
  if(BigInt(cmd.data.tenderedMinor)<BigInt(cmd.data.amountMinor))throw new ValidationError("Tendered amount cannot be below applied amount.");
  if(cmd.data.method!=="cash" && (cmd.data.amountMinor!==cmd.data.tenderedMinor ||
    !cmd.data.reference || cmd.data.reference.length<3))throw new ValidationError("External tender requires staff reference and exact allocation.");
 }
 const payload={action:cmd.action,data:cmd.data};
 const digest=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 // Replay is accessible for recovered successful commands without permitting a second capture.
 const old=await run<Record<string,unknown>|null>(actor,outletId,
  sql`select app_private.pos_finance_replay(${outletId},${cmd.key},${digest},${cmd.action}) as result`);
 if(old)return old;
 if(cmd.action==="profile")
  return run<Record<string,unknown>>(actor,outletId,sql`select app_private.pos_set_tax_profile(
   ${outletId},${cmd.key},${digest},${JSON.stringify(cmd.data)}::jsonb) as result`);
 return run<Record<string,unknown>>(actor,outletId,sql`select app_private.pos_finance_command(
  ${outletId},${cmd.key},${digest},${cmd.action},${JSON.stringify(cmd.data)}::jsonb) as result`);
}
export const financeCommandSchema=commands;
