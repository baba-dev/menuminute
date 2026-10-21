import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { admin } from "../helpers";
import { createRestaurant } from "../../src/modules/restaurants/service";

test("workspace selection persists after login on a fresh browser and device revocation is confirmed", async ({page,browser}) => {
  test.setTimeout(75_000);
  const id=crypto.randomUUID(), email="continuity-"+id+"@browser.invalid";
  const password="continuity-browser-password";
  await admin(async (_db,pool) => {
    await pool.query("insert into users(id,name,email,email_verified) values($1,'Continuity owner',$2,true)",[id,email]);
    await pool.query("insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(),id,await hashPassword(password)]);
  });
  const first=await createRestaurant(id,{name:"First Continuity",country:"IN",currency:"INR",timezone:"Asia/Kolkata",outletType:"restaurant"});
  const second=await createRestaurant(id,{name:"Second Continuity",country:"IN",currency:"INR",timezone:"Asia/Kolkata",outletType:"restaurant"});
  async function login(target: typeof page) {
    await target.goto("/login");
    await target.getByLabel("Email address").fill(email);
    await target.getByLabel("Password",{exact:true}).fill(password);
    await target.getByRole("button",{name:"Sign in",exact:true}).click();
    await expect(target).toHaveURL(/\/dashboard/);
  }
  await login(page);
  await page.goto("/account");
  await page.getByRole("button",{name:/Second Continuity/}).click();
  await expect(page.getByText("Default workspace saved across your devices.")).toBeVisible();
  const firstSelection=await page.request.get("/api/context");
  expect((await firstSelection.json()).selectedOutletId).toBe(second.id);
  const other=await browser.newContext({baseURL:"https://localhost:3443",ignoreHTTPSErrors:true});
  try {
    const tab=await other.newPage();
    await login(tab);
    const restored=await tab.request.get("/api/context");
    const context=await restored.json();
    expect(context.selectedOutletId).toBe(second.id);
    expect(context.selectedOrganizationId).toBe(second.organizationId);
    await page.goto("/account/security");
    await expect(page.getByRole("heading",{name:"Where you're signed in."})).toBeVisible();
    await expect(page.getByText("This device")).toHaveCount(1);
    await page.getByRole("button",{name:"Sign out other devices"}).click();
    await expect(page.getByText("Sign out all other devices?")).toBeVisible();
    await page.getByRole("button",{name:"Confirm sign out"}).click();
    await expect(page.getByText(/session.*revoked/)).toBeVisible();
    await tab.goto("/dashboard");
    await expect(tab).toHaveURL(/\/login/);
    await page.reload();
    await expect(page.getByRole("heading",{name:"Where you're signed in."})).toBeVisible();
    const sessions=await page.request.get("/api/security/devices");
    expect((await sessions.json()).devices.some((d:{current:boolean})=>d.current)).toBe(true);
    expect(first.id).not.toBe(second.id);
  } finally { await other.close(); }
});
