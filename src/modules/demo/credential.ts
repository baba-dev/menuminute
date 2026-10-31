import { createHmac } from "node:crypto";
import { DEMO_IDS } from "./ids";

/**
 * The demo owner has a real credential so sessions come from the standard Better Auth sign-in path
 * (session cookies, revocation, expiry) rather than hand-built cookies. The password is derived from
 * the server secret, never published and never typed by a visitor; only /demo/enter can use it.
 */
export function demoPassword(authSecret: string): string {
  return createHmac("sha256", authSecret)
    .update(`menuminute-demo-credential:${DEMO_IDS.userId}`)
    .digest("hex");
}
