import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { admin } from "../helpers";
import { createRestaurant } from "../../src/modules/restaurants/service";

// This is an isolated synthetic user and authenticator, never a real recovery code or secret.
function codeFor(uri: string) {
  const encoded = new URL(uri).searchParams.get("secret");
  if (!encoded) throw new Error("Synthetic enrollment URI omitted the secret");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const letter of encoded.toUpperCase().replace(/=+$/, "")) {
    const digit = alphabet.indexOf(letter);
    if (digit < 0) throw new Error("Invalid synthetic TOTP key");
    value = (value << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const result = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
  const offset = result[result.length - 1]! & 15;
  return ((result.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, "0");
}

test("new owner enrolls MFA, confirms privileged action, and recovers sign-in with a backup code", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.context().setExtraHTTPHeaders({ "x-browser-test-client": crypto.randomUUID() });
  const id = crypto.randomUUID();
  const email = `mfa-${id}@browser.invalid`;
  const password = "browser-mfa-strong-password";
  await admin(async (_db, pool) => {
    await pool.query(
      "insert into users(id,name,email,email_verified) values($1,'MFA browser owner',$2,true)",
      [id, email]
    );
    await pool.query(
      "insert into accounts(id,user_id,provider_id,account_id,password) values($1,$2,'credential',$2,$3)",
      [crypto.randomUUID(), id, await hashPassword(password)]
    );
  });
  const outlet = await createRestaurant(id, {
    name: "Secured Browser Kitchen",
    country: "IN",
    currency: "INR",
    timezone: "Asia/Kolkata",
    outletType: "restaurant",
  });
  await admin(async (_db, pool) => {
    const org = await pool.query<{ mfa_required: boolean }>(
      "select mfa_required from organizations where id=$1",
      [outlet.organizationId]
    );
    expect(org.rows[0]?.mfa_required).toBe(true);
  });
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Isolated localhost browser fixtures opt out of the mandatory redirect only.
  // The production policy remains enforced, and this new organization must require MFA.
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/account/security");
  await expect(page.getByRole("heading", { name: "Account security" })).toBeVisible();
  await page.getByLabel("Confirm password to enroll").fill(password);
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  await expect(page.locator("details code")).toHaveText(/otpauth:\/\/totp\//);
  const uri = await page.locator("details code").textContent();
  expect(uri).toBeTruthy();
  const codes = await page.getByTestId("backup-codes").locator("code").allTextContents();
  expect(codes.length).toBeGreaterThan(0);
  await page.getByLabel("Authenticator code").fill(codeFor(uri!));
  await page.getByRole("button", { name: "Verify enrollment" }).click();
  await expect(page.getByRole("status")).toContainText("Two-factor authentication enabled.");
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("Authenticator code").fill(codeFor(uri!));
  await page.getByRole("button", { name: "Confirm privileged action" }).click();
  await expect(page.getByRole("status")).toContainText("Confirmed.");
  await page.getByRole("button", { name: "Sign out all devices" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/two-factor/);
  await page.getByRole("button", { name: "Use recovery code" }).click();
  await page.getByLabel("Recovery code").fill(codes[0]!);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
