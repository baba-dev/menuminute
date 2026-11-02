import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { admin } from "../helpers";
import { createRestaurant } from "../../src/modules/restaurants/service";

test("security workspace preserves credential sign-in and changes password", async ({ page }) => {
  test.setTimeout(90_000);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const id = crypto.randomUUID();
  const email = "security-v2-" + id + "@browser.invalid";
  const password = "initial-security-v2-password";
  const next = "updated-security-v2-password";
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Security V2 owner',$2,true)",
      [id, email]
    );
    await pool.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), id, await hashPassword(password)]
    );
  });
  await createRestaurant(id, {
    name: "Security test kitchen",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/account/security");
  await expect(page.getByTestId("account-security-workspace")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your account. Protected." })).toBeVisible();
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.locator(".mm-sec-feedback")).toContainText("Password changed successfully");

  await page.getByRole("button", { name: "Sign out all devices" }).click();
  await page.getByRole("button", { name: "Confirm sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(next);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
