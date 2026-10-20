import { env, type Env } from "@/lib/config/env";
import { createResendTransport } from "./providers/resend";
import { createSmtpTransport } from "./providers/smtp";
import { createTestTransport } from "./providers/test";
import type { EmailTransport, TransactionalEmail } from "./transport";

export function createEmailTransport(config: Env): EmailTransport {
  if (config.EMAIL_PROVIDER === "smtp")
    return createSmtpTransport({
      host: config.SMTP_HOST!,
      port: config.SMTP_PORT!,
      secure: config.SMTP_SECURE!,
      user: config.SMTP_USER!,
      password: config.SMTP_PASSWORD!,
    });
  if (config.EMAIL_PROVIDER === "resend") return createResendTransport(config.RESEND_API_KEY!);
  return createTestTransport();
}

let transport: EmailTransport | undefined;

export async function sendTransactionalEmail(message: Omit<TransactionalEmail, "from">) {
  transport ??= createEmailTransport(env);
  await transport.send({ ...message, from: env.EMAIL_FROM ?? "test@localhost.invalid" });
}

export { EmailDeliveryError } from "./transport";
