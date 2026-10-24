import {describe,it,expect} from "vitest";
import {fixture,admin} from "./helpers";
import {menuDocumentSchema} from "../src/modules/menu-product/contracts";
import {commandMenu,menuDetail} from "../src/modules/menu-product/service";
import {createConversation} from "../src/modules/intelligence/store";
import {availabilityOptions,proposeAvailability,decideAvailability,actionHistory,proposalInput,decisionInput} from "../src/modules/intelligence/actions";
import {navigation,navigationForPermissions,routesForEvidence} from "../src/modules/intelligence/navigation";
const id=()=>crypto.randomUUID();
const document=()=>menuDocumentSchema.parse({
 name:"Published lunch",currency:"INR",categories:[{id:"mains",name:"Mains",items:[
  {id:"paneer",name:"Paneer Tikka",priceMinor:15000},
  {id:"rice",name:"Rice",priceMinor:10000}
 ]}]
});
async function setup(){
 const f=await fixture(),scope={actor:f.actor,organizationId:f.outlet.organizationId,outletId:f.outlet.id};
 const menuId=id();await commandMenu(f.actor,f.outlet.id,menuId,{key:id(),expectedRevision:0,action:"create",data:{document:document()}});
 const before=await menuDetail(f.actor,menuId);
 await commandMenu(f.actor,f.outlet.id,menuId,{key:id(),expectedRevision:before.revision,action:"publish",data:{}});
 const conversation=await createConversation(scope,id());
 return {f,scope,menuId,conversation};
}
function input(s:Awaited<ReturnType<typeof setup>>,key=id(),desiredSoldOut=true){
 return {...s.scope,conversationId:s.conversation.id,menuId:s.menuId,dishId:"paneer",desiredSoldOut,key};
}
describe("Ember proposals, atomic confirmation and restricted navigation",()=>{
 it("previews only published and assigned dishes and preserves unrelated outlet price override",async()=>{
  const s=await setup();
  const menu=await menuDetail(s.f.actor,s.menuId);
  await commandMenu(s.f.actor,s.f.outlet.id,s.menuId,{action:"override",key:id(),
   expectedRevision:menu.revision,data:{outletId:s.f.outlet.id,dishId:"paneer",priceMinor:13500,soldOut:null}});
  const choices=await availabilityOptions(s.scope);
  expect(choices).toMatchObject([{id:s.menuId,name:"Published lunch"}]);
  expect(choices[0]?.items.find(i=>i.id==="paneer")?.soldOut).toBe(false);
  const key=id(),p=await proposeAvailability(s.scope,input(s,key));
  expect(p).toMatchObject({status:"pending",dishName:"Paneer Tikka",beforeSoldOut:false,desiredSoldOut:true});
  expect((await proposeAvailability(s.scope,input(s,key))).id).toBe(p.id);
  await expect(proposeAvailability(s.scope,input(s,key,false))).rejects.toMatchObject({statusCode:409});
  const decision=id(),receipt=await decideAvailability(s.scope,p.id,{...s.scope,key:decision,decision:"confirm"});
  expect(receipt).toMatchObject({status:"confirmed",soldOut:true,dishId:"paneer"});
  expect(await decideAvailability(s.scope,p.id,{...s.scope,key:decision,decision:"confirm"})).toEqual(receipt);
  await expect(decideAvailability(s.scope,p.id,{...s.scope,key:id(),decision:"confirm"})).rejects.toMatchObject({statusCode:409});
  await admin(async(_db,pool)=>{
   const rows=await pool.query("select sold_out,price_minor from menu_overrides where menu_id=$1 and outlet_id=$2 and dish_id='paneer'",[s.menuId,s.f.outlet.id]);
   expect(rows.rows[0]).toMatchObject({sold_out:true,price_minor:13500});
   const n=await pool.query("select count(*)::int as n from domain_commands where request_key=$1",["ember:"+p.id]);
   expect(n.rows[0].n).toBe(1);
  });
  expect((await actionHistory(s.scope,s.conversation.id))[0]).toMatchObject({status:"confirmed"});
 });
 it("rejects stale revisions, expired confirmations, cross-outlet and revoked actors",async()=>{
  const s=await setup(),foreign=await fixture();
  const p=await proposeAvailability(s.scope,input(s));
  await expect(decideAvailability({...s.scope,actor:foreign.actor},p.id,{...s.scope,key:id(),decision:"confirm"})).rejects.toMatchObject({statusCode:403});
  const menu=await menuDetail(s.f.actor,s.menuId);
  await commandMenu(s.f.actor,s.f.outlet.id,s.menuId,{key:id(),action:"save",
   expectedRevision:menu.revision,data:{document:{...document(),name:"Changed lunch"}}});
  const stale=await decideAvailability(s.scope,p.id,{...s.scope,key:id(),decision:"confirm"});
  expect(stale.status).toBe("stale");
  const fresh=await proposeAvailability(s.scope,input(s));
  await admin(async(_db,pool)=>pool.query("update assistant_action_proposals set expires_at=now()-interval '1 minute' where id=$1",[fresh.id]));
  await expect(decideAvailability(s.scope,fresh.id,{...s.scope,key:id(),decision:"confirm"})).rejects.toMatchObject({statusCode:409});
  await admin(async(_db,pool)=>pool.query("update organization_members set is_active=false where user_id=$1",[s.f.actor.userId]));
  await expect(decideAvailability(s.scope,fresh.id,{...s.scope,key:id(),decision:"confirm"})).rejects.toMatchObject({statusCode:403});
  await admin(async(_db,pool)=>{
   const q=await pool.query("select count(*)::int as count from menu_overrides where menu_id=$1",[s.menuId]);
   expect(q.rows[0].count).toBe(0);
  });
 });
 it("supports explicit rejection and disallows malformed or unrecognized action commands",async()=>{
  const s=await setup();
  const p=await proposeAvailability(s.scope,input(s));
  const rejected=await decideAvailability(s.scope,p.id,{...s.scope,key:id(),decision:"reject"});
  expect(rejected.status).toBe("rejected");
  expect(proposalInput.safeParse({...input(s),action:"refund"}).success).toBe(false);
  expect(decisionInput.safeParse({...s.scope,key:id(),decision:"publish"}).success).toBe(false);
  await expect(proposeAvailability(s.scope,{...input(s),dishId:"missing"})).rejects.toMatchObject({statusCode:422});
 });
 it("routes evidence only through server-defined, permission-filtered first-party destinations",()=>{
  const allowed=navigationForPermissions({menuRead:true,ordersRead:false,menuWrite:false});
  expect(allowed.map(r=>r.id)).toEqual(["overview","menu","qr"]);
  expect(routesForEvidence([{tool:"orders.pulse"},{tool:"menu.summary"},{tool:"https://attacker.invalid"}],allowed.map(r=>r.id)))
   .toEqual([{id:"menu",...navigation.menu}]);
  expect(Object.values(navigation).every(r=>r.href.startsWith("/")&&!r.href.startsWith("//"))).toBe(true);
 });
});
