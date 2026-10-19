import { env } from "@/lib/config/env";

/** Only isolated CI can use the in-process sink; never print links or tokens to logs. */
const testMessages: Array<{ to: string; subject: string; text: string }> = [];
export function drainAuthTestMessages() {
  if (env.NODE_ENV !== "test") throw new Error("Test mail is not available");
  return testMessages.splice(0);
}
export async function sendAuthEmail(to: string, subject: string, url: string) {
  const target = new URL(url);
  if (
    target.origin !== new URL(env.APP_URL).origin ||
    target.protocol !== new URL(env.APP_URL).protocol
  )
    throw new Error("Invalid authentication email destination");
  const text = `${subject}\n\nOpen this link to continue:\n${target.toString()}\n\nIf you did not request this, ignore this email. The link expires automatically.`;
  if (env.EMAIL_PROVIDER === "test") {
    if (
      !env.AUTH_ALLOW_TEST_EMAIL ||
      new URL(env.APP_URL).hostname !== "localhost" ||
      new URL(env.DATABASE_URL).pathname !== "/menuminute_test"
    )
      throw new Error("Test email transport requires an isolated localhost database");
    testMessages.push({ to, subject, text });
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) {
    // Never log API keys, email addresses, returned payloads, or auth links.
    throw new Error("Authentication email delivery failed");
  }
}
