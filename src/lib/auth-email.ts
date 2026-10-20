import { env } from "@/lib/config/env";
import { sendTransactionalEmail } from "@/lib/email";
import { drainTestMessages } from "@/lib/email/providers/test";

/** Compatibility facade for existing Better Auth and security-event callers. */
export function drainAuthTestMessages() {
  if (env.NODE_ENV !== "test") throw new Error("Test mail is not available");
  return drainTestMessages();
}
export async function sendAuthEmail(to: string, subject: string, url: string) {
  const target = new URL(url);
  if (
    target.origin !== new URL(env.APP_URL).origin ||
    target.protocol !== new URL(env.APP_URL).protocol
  )
    throw new Error("Invalid authentication email destination");
  const text = `${subject}\n\nOpen this link to continue:\n${target.toString()}\n\nIf you did not request this, ignore this email. The link expires automatically.`;
  await sendTransactionalEmail({ to, subject, text });
}
