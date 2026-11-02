import { env } from "@/lib/config/env";
import { sendTransactionalEmail } from "@/lib/email";
import { drainTestMessages } from "@/lib/email/providers/test";
import { renderEmail } from "@/lib/email/template";

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
  const { html, text } = renderEmail(
    {
      preheader: "Open this link to continue. It expires automatically.",
      eyebrow: "Account",
      heading: subject,
      paragraphs: ["Use the button below to continue. The link works for a short time only."],
      action: { label: "Continue", url: target.toString() },
      note: "If you did not request this, you can safely ignore this email.",
    },
    env.APP_URL
  );
  await sendTransactionalEmail({ to, subject, text, html });
}
