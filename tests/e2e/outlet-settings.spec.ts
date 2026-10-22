import {expect,test} from "@playwright/test";
import {Pool} from "pg";
import {hashPassword} from "better-auth/crypto";
async function seed() {
 const url=process.env["MIGRATION_DATABASE_URL"];
 if(!url||new URL(url).pathname!=="/menuminute_test")throw new Error("Isolated test database required");
 const pool=new Pool({connectionString:url,max:1});
 const user=crypto.randomUUID(),outlet=crypto.randomUUID(),other=crypto.randomUUID();
 const email="atelier-"+user+"@browser.invalid",password="atelier-browser-password";
 const client=await pool.connect();
 try{
  await client.query("begin");
  await client.query("insert into users(id,name,email,email_verified) values($1,'Atelier owner',$2,true)",[user,email]);
  await client.query("insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",[crypto.randomUUID(),user,await hashPassword(password)]);
  await client.query("select set_config('app.actor_id',$1,true)",[user]);
  for(const [id,name] of [[outlet,"Atelier Kitchen"],[other,"Second Kitchen"]]){
   await client.query("select app_private.provision_organization($1,$2,$3::jsonb)",[id,crypto.randomUUID(),
    JSON.stringify({name,country:"IN",currency:"INR",timezone:"Asia/Kolkata",outletType:"restaurant"})]);
   await client.query("update organizations set mfa_required=false where id=$1",["org-"+id]);
  }
  await client.query("commit");
 }catch(e){await client.query("rollback");throw e;}finally{client.release();await pool.end();}
 return {email,password,outlet,other};
}
test("Outlet Atelier saves scoped profile and remains responsive in both themes",async({page})=>{
 const f=await seed();
 await page.goto("/login");await page.getByLabel("Email address").fill(f.email);
 await page.getByLabel("Password",{exact:true}).fill(f.password);
 await page.getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page).toHaveURL(/dashboard/);
 await page.goto("/dashboard/settings");
 await expect(page.getByTestId("outlet-atelier")).toBeVisible();
 await expect(page.getByRole("heading",{name:/Every detail/})).toBeVisible();
 await expect(page.getByRole("heading",{name:"Restaurant profile."})).toBeVisible();
 await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content",/noindex/);
 await page.getByLabel("Description").fill("Bespoke neighborhood dining");
 await page.getByLabel("Public phone").fill("+91 9876543210");
 await page.getByLabel("Public email").fill("info@example.com");
 await page.getByLabel("Website URL").fill("https://example.com");
 await page.getByLabel("Primary hex color").fill("#abcdef");
 await expect(page.getByText("Unsaved changes")).toBeVisible();
 await page.getByRole("button",{name:"Save profile"}).click();
 await expect(page.getByRole("status").getByText("Profile saved successfully.")).toBeVisible();
 await page.reload();
 await expect(page.getByLabel("Description")).toHaveValue("Bespoke neighborhood dining");
 await expect(page.getByLabel("Public phone")).toHaveValue("+91 9876543210");
 await expect(page.getByLabel("Primary hex color")).toHaveValue("#abcdef");
 for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.getByRole("button",{name:"Switch to dark mode"}).click();
 await expect(page.locator("html")).toHaveAttribute("data-theme","dark");
 await expect(page.getByRole("heading",{name:"Operational identity."})).toBeVisible();
 await expect(page.getByText("INR",{exact:true}).first()).toBeVisible();
});
test("Outlet Atelier rejects stale profile saves across two authorized sessions",async({browser})=>{
 const f=await seed();
 const pages=[await browser.newPage(),await browser.newPage()];
 for(const page of pages){
  await page.goto("/login");await page.getByLabel("Email address").fill(f.email);
  await page.getByLabel("Password",{exact:true}).fill(f.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/dashboard/settings");
 }
 await pages[0]!.getByLabel("Description").fill("First committed description");
 await pages[0]!.getByRole("button",{name:"Save profile"}).click();
 await expect(pages[0]!.getByText("Profile saved successfully.")).toBeVisible();
 await pages[1]!.getByLabel("Description").fill("A stale conflicting version");
 await pages[1]!.getByRole("button",{name:"Save profile"}).click();
 await expect(pages[1]!.getByRole("alert")).toContainText("changed elsewhere");
 await pages[1]!.getByRole("button",{name:"Reload latest"}).click();
 await expect(pages[1]!.getByLabel("Description")).toHaveValue("First committed description");
 for(const page of pages)await page.close();
});
