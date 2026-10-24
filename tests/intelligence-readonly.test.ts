import {describe,expect,it,vi} from "vitest";
import {fixture,admin} from "./helpers";
import {createConversation,listConversations,conversationHistory,beginTurn,reserveAttempt,settleAttempt,finishTurn,conversationInput} from "../src/modules/intelligence/store";
import {executeReadTool,toolDefinitions} from "../src/modules/intelligence/read-tools";
import {boundedJson} from "../src/modules/intelligence/request";
import {runReadOnlyTurn} from "../src/modules/intelligence/orchestrator";
import {createProviderHub} from "../src/modules/intelligence";
import {parseEnv} from "../src/lib/config/env";
import {withActor} from "../src/modules/tenancy/service";
import {sql} from "drizzle-orm";
const uuid=()=>crypto.randomUUID();
describe("Ember scoped persistence and read-only execution",()=>{
 it("keeps conversations and attempts private, idempotent, bounded and durable",async()=>{
  const first=await fixture(),other=await fixture();
  const scope={actor:first.actor,organizationId:first.outlet.organizationId,outletId:first.outlet.id};
  const key=uuid(),conversation=await createConversation(scope,key);
  expect((await createConversation(scope,key)).id).toBe(conversation.id);
  expect(await listConversations(scope)).toHaveLength(1);
  await expect(createConversation({
   actor:other.actor,organizationId:first.outlet.organizationId,outletId:first.outlet.id,
  },uuid())).rejects.toThrow();
  const otherScope={actor:other.actor,organizationId:other.outlet.organizationId,outletId:other.outlet.id};
  await expect(conversationHistory(otherScope,conversation.id)).rejects.toThrow();
  const input={key:uuid(),prompt:"How many orders are pending?"};
  const started=await beginTurn(scope,conversation.id,input);
  expect(started.created).toBe(true);
  const replay=await beginTurn(scope,conversation.id,input);
  expect(replay.created).toBe(false);
  expect(replay.turn.id).toBe(started.turn.id);
  await expect(beginTurn(scope,conversation.id,{...input,prompt:"Different prompt"})).rejects.toThrow();
  await expect(beginTurn(scope,conversation.id,{key:uuid(),prompt:"Another request"})).rejects.toThrow();
  const attempt=await reserveAttempt(scope,started.turn,1,"nvidia","reviewed/model");
  await expect(reserveAttempt(scope,started.turn,1,"nvidia","reviewed/model")).rejects.toThrow();
  await settleAttempt(scope,attempt,null);
  await finishTurn(scope,started.turn.id,"There is no settled revenue in this view.",[]);
  const history=await conversationHistory(scope,conversation.id);
  expect(history.turns).toHaveLength(1);
  expect(history.turns[0]).toMatchObject({status:"completed",answer:"There is no settled revenue in this view."});
  await admin(async(_db,pool)=>{
   const state=await pool.query("select status,input_tokens from assistant_attempts where id=$1",[attempt]);
   expect(state.rows[0]).toMatchObject({status:"uncertain",input_tokens:null});
   const rls=await pool.query("select relname,relrowsecurity,relforcerowsecurity from pg_class where relname like 'assistant_%' and relkind='r' and relname<>'assistant_org_daily_budget'");
   expect(rls.rows).toHaveLength(3);
   expect(rls.rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
  });
  const visibility=await withActor(other.actor,async tx=>{
   await tx.execute(sql`select set_config('app.outlet_id',${other.outlet.id},true)`);
   return tx.execute(sql`select id from assistant_conversations where id=${conversation.id}`);
  });
  expect(visibility.rows).toHaveLength(0);
 });
 it("runs two fake provider attempts and persists bounded, redacted evidence",async()=>{
  const f=await fixture(),scope={actor:f.actor,organizationId:f.outlet.organizationId,outletId:f.outlet.id};
  const convo=await createConversation(scope,uuid());
  const start=await beginTurn(scope,convo.id,{key:uuid(),prompt:"What is my order queue?"});
  let n=0;
  const fake=vi.fn(async()=>{
   n++;
   return new Response(JSON.stringify(n===1?{
     choices:[{finish_reason:"tool_calls",message:{content:null,tool_calls:[
       {id:"tool_1",type:"function",function:{name:"orders.pulse",arguments:"{}"}},
     ]}}],
     usage:{prompt_tokens:13,completion_tokens:8,total_tokens:21},
   }:{
     choices:[{finish_reason:"stop",message:{content:"This is the authorized order pulse, not collected revenue."}}],
     usage:{prompt_tokens:20,completion_tokens:11,total_tokens:31},
   }),{headers:{"content-type":"application/json"}});
  }) as unknown as typeof fetch;
  const config=parseEnv({...process.env,
   AI_FEATURES_ENABLED:"true",AI_ORCHESTRATOR_ENABLED:"true",
   AI_NVIDIA_ENABLED:"true",AI_NVIDIA_COMMERCIAL_APPROVED:"true",
   NVIDIA_API_KEY:"unit-test-only-key",AI_NVIDIA_MODEL:"reviewed/model",
   AI_NVIDIA_TOOLS_VERIFIED:"true",AI_CLOUDFLARE_ENABLED:"false",
  });
  const hub=createProviderHub(config,fake);
  const result=await runReadOnlyTurn(scope,start.turn,hub,executeReadTool,true);
  expect(result.status).toBe("completed");
  expect(result.evidence?.[0]).toMatchObject({tool:"orders.pulse",source:"orders.servicePulse"});
  expect(JSON.stringify(result.evidence)).not.toContain("customerPhone");
  expect(n).toBe(2);
  const saved=await conversationHistory(scope,convo.id);
  expect(saved.turns[0]?.status).toBe("completed");
  await admin(async(_db,pool)=>{
   const attempts=await pool.query("select round,status,input_tokens,output_tokens from assistant_attempts where turn_id=$1 order by round",[start.turn.id]);
   expect(attempts.rows).toMatchObject([
     {round:1,status:"completed",input_tokens:13,output_tokens:8},
     {round:2,status:"completed",input_tokens:20,output_tokens:11},
   ]);
  });
 });
 it("exposes only four read tools and rejects oversized request bodies",async()=>{
  expect(toolDefinitions().map(t=>t.name)).toEqual(["orders.pulse","orders.history","kitchen.pulse","menu.summary"]);
  expect(toolDefinitions().every(t=>!/(write|delete|sql|fetch|refund)/.test(t.name))).toBe(true);
  await expect(boundedJson(new Request("https://example.test",{method:"POST",body:"x".repeat(6100)}))).rejects.toThrow();
  expect(conversationInput.safeParse({organizationId:"o",outletId:"x",key:uuid(),admin:true}).success).toBe(false);
 });
});
