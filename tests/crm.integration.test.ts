import { describe, expect, it } from "vitest";
import { admin, fixture } from "./helpers";
import { applyEntitlement } from "../src/modules/billing/operator";
import { commandMenu } from "../src/modules/menu-product/service";
import { submitGuestOrder } from "../src/modules/orders/service";
import { guestDetail, listGuests, saveGuest, lookupGuest, eraseGuest } from "../src/modules/crm/service";

async function grant(orgId: string) {
  await admin(async (_db,pool) => applyEntitlement(pool, {
    key:crypto.randomUUID(),organizationId:orgId,operator:"crm-test",reason:"CRM integration",
    action:"grant",capability:"ordering.new",billingCurrency:"USD",
    startsAt:new Date(Date.now()-60000).toISOString(),
    endsAt:new Date(Date.now()+3600000).toISOString(),
  }));
}
describe("paid guest CRM — PostgreSQL security and order history",()=>{
  it("blocks Free and unauthorized tenants; enables Ordering automatically",async()=>{
    const f=await fixture();
    await expect(listGuests(f.actor,f.outlet.organizationId,f.outlet.id,"",0)).rejects.toThrow();
    await grant(f.outlet.organizationId);
    expect((await listGuests(f.actor,f.outlet.organizationId,f.outlet.id,"",0)).items).toEqual([]);
    const other=await fixture();
    await expect(listGuests(f.actor,other.outlet.organizationId,other.outlet.id,"",0)).rejects.toThrow();
  });
  it("deduplicates a guest number and keeps erased profiles suppressed",async()=>{
    const f=await fixture();
    await grant(f.outlet.organizationId);
    const first=await saveGuest(f.actor,f.outlet.organizationId,f.outlet.id,{
      id:null,phone:"9876543210",name:"Priya",notes:"Asked for mild food"
    });
    const second=await saveGuest(f.actor,f.outlet.organizationId,f.outlet.id,{
      id:null,phone:"+91 9876543210",name:"Priya Sharma",notes:"Remember preference"
    });
    expect(second.id).toBe(first.id);
    const found=await lookupGuest(f.actor,f.outlet.organizationId,f.outlet.id,"9876543210");
    expect(found?.name).toBe("Priya Sharma");
    expect((await guestDetail(f.actor,f.outlet.organizationId,f.outlet.id,first.id))?.notes)
      .toBe("Remember preference");
    expect((await eraseGuest(f.actor,f.outlet.organizationId,f.outlet.id,first.id)).erased).toBe(true);
    expect(await lookupGuest(f.actor,f.outlet.organizationId,f.outlet.id,"9876543210")).toBeNull();
    await expect(saveGuest(f.actor,f.outlet.organizationId,f.outlet.id,{
      id:null,phone:"9876543210",name:"Resurrected",notes:""
    })).rejects.toThrow();
  });
  it("links public checkout by mobile into the merchant-only history",async()=>{
    const f=await fixture();
    const menuId=crypto.randomUUID();
    await commandMenu(f.actor,f.outlet.id,menuId,{
      key:crypto.randomUUID(),expectedRevision:0,action:"create",
      data:{document:{name:"CRM menu",currency:f.outlet.currency,categories:[{
        id:"food",name:"Meals",items:[{id:"plate",name:"Plate",priceMinor:12500}]
      }]}}
    });
    await commandMenu(f.actor,f.outlet.id,menuId,{key:crypto.randomUUID(),expectedRevision:1,
      action:"publish",data:{}});
    await grant(f.outlet.organizationId);
    const order=await submitGuestOrder(f.outlet.publicId,{
      clientSubmissionKey:crypto.randomUUID(),quotedTotalMinor:12500,fulfillmentMode:"dine_in",
      customerName:"Returning Guest",customerPhone:"9876543210",
      items:[{dishId:"plate",quantity:1,selectedAddOns:[]}]
    });
    const found=await lookupGuest(f.actor,f.outlet.organizationId,f.outlet.id,"+919876543210");
    expect(found).not.toBeNull();
    const details=await guestDetail(f.actor,f.outlet.organizationId,f.outlet.id,found!.id);
    expect(details?.orders.some((x)=>x.id===order.orderId)).toBe(true);
    await admin(async (_db,pool)=>{
      const rows=await pool.query("select count(*)::int as n from crm_guest_orders where order_id=$1",[order.orderId]);
      expect(rows.rows[0]?.n).toBe(1);
    });
  });
});
