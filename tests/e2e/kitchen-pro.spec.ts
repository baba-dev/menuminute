import { expect,test } from "@playwright/test";
import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";
async function seed(){
 const url=process.env["MIGRATION_DATABASE_URL"];
 if(!url||new URL(url).pathname!=="/menuminute_test")throw new Error("Isolated test database required");
 const pool=new Pool({connectionString:url,max:1});
 const owner=crypto.randomUUID(),outlet=crypto.randomUUID(),token=crypto.randomUUID();
 const email=`kitchen-${owner}@browser.invalid`,password="kitchen-browser-password";
 const c=await pool.connect();
 try{
  await c.query("BEGIN");
  await c.query("insert into users(id,name,email,email_verified) values($1,'Kitchen owner',$2,true)",[owner,email]);
  await c.query("insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",[crypto.randomUUID(),owner,await hashPassword(password)]);
  await c.query("select set_config('app.actor_id',$1,true)",[owner]);
  await c.query("select app_private.provision_organization($1,$2,$3::jsonb)",[outlet,token,JSON.stringify({name:"Browser Kitchen",country:"IN",currency:"INR",timezone:"Asia/Kolkata",outletType:"restaurant"})]);
  await c.query("update organizations set mfa_required=false where id=$1",["org-"+outlet]);
  await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK");throw e;}
 finally{c.release();await pool.end();}
 return {email,password,outlet,org:"org-"+outlet};
}
test("Kitchen Pro is scoped, responsive, and safely setup-only before commercial release",async({page})=>{
 const f=await seed();
 await page.goto("/login");
 await page.getByLabel("Email address").fill(f.email);
 await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page).toHaveURL(/dashboard/);
 await page.goto("/kitchen");
 await expect(page.getByRole("heading",{name:"Browser Kitchen"})).toBeVisible();
 await expect(page.getByText("Kitchen setup mode.",{exact:false})).toBeVisible();
 await expect(page.getByText("Kitchen Dashboard Coming in Phase D")).toHaveCount(0);
 await page.getByRole("button",{name:"Station setup"}).click();
 await page.getByLabel("Station name").fill("Grill");
 await page.getByRole("button",{name:"Create station"}).click();
 await expect(page.getByRole("navigation",{name:"Kitchen stations"}).getByRole("button",{name:"Grill"})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Grill",exact:true})).toBeVisible();
 const current=await page.request.get(`/api/organizations/${f.org}/outlets/${f.outlet}/kitchen`);
 expect(current.status()).toBe(200);
 const body=await current.json() as {enabled:boolean;stations:Array<{name:string}>};
 expect(body.enabled).toBe(false);
 expect(body.stations.map(s=>s.name)).toContain("Grill");
 await expect(page.getByRole("button",{name:"Start preparing"})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole("button",{name:"Sync",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Grill",exact:true})).toBeVisible();
});
