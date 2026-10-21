import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { admin } from "../helpers";
import { createRestaurant } from "../../src/modules/restaurants/service";

async function account() {
  const id = crypto.randomUUID();
  const email = "returning-" + id + "@browser.invalid";
  const password = "browser-returning-password";
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'Returning owner',$2,true)",
      [id, email]
    );
    await pool.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), id, await hashPassword(password)]
    );
  });
  await createRestaurant(id, {
    name: "Returning Restaurant",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
  });
  return { email, password };
}
test("remembered sign-in survives navigation; homepage and login recognise the account", async ({
  page,
}) => {
  const { email, password } = await account();
  await page.goto("/login");
  await expect(page.getByLabel("Remember me")).toBeChecked();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const tokens = await page.context().cookies();
  expect(tokens.some((c) => c.name.includes("session_token") && c.expires > Date.now() / 1000)).toBe(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /dashboard|restaurant|welcome/i }).first()).toBeVisible();
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 1000) < 768)
    await page.getByRole("button", { name: "Open navigation menu" }).click();
  await expect(page.getByRole("link", { name: "Open Dashboard" })).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/login?switch=1");
  await expect(page.getByRole("heading", { name: "You're already signed in." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out and use another account" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email address")).toHaveValue("");
});
test("non-remembered sign-in is a browser-session cookie and rejects unsafe return URLs", async ({
  page,
}) => {
  const { email, password } = await account();
  await page.goto("/login?next=https%3A%2F%2Fevil.invalid");
  await page.getByLabel("Remember me").uncheck();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  const cookie = (await page.context().cookies()).find((c) => c.name.includes("session_token"));
  expect(cookie).toBeDefined();
  expect(cookie!.expires).toBe(-1);
});
test("connection interruption does not erase login entries or claim an intentional logout", async ({
  page,
}) => {
  await page.route("**/api/auth/sign-in/email", (route) => route.abort());
  await page.goto("/login");
  await page.getByLabel("Email address").fill("owner@browser.invalid");
  await page.getByLabel("Password", { exact: true }).fill("temporary-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(/temporarily unavailable|Unable to connect/);
  await expect(page.getByLabel("Email address")).toHaveValue("owner@browser.invalid");
});
