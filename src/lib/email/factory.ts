import { createResendTransport } from "./providers/resend";
import { createSmtpTransport } from "./providers/smtp";
import { createTestTransport } from "./providers/test";
import type { EmailTransport } from "./transport";

/** The settings a mail transport needs. Env-free, so the worker can build one from its own settings. */
export type EmailConfig = Readonly<{
  EMAIL_PROVIDER: "smtp" | "resend" | "test";
  EMAIL_FROM?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  SMTP_HOST?: string | undefined;
  SMTP_PORT?: number | undefined;
  SMTP_SECURE?: boolean | undefined;
  SMTP_USER?: string | undefined;
  SMTP_PASSWORD?: string | undefined;
}>;

export function createEmailTransport(config: EmailConfig): EmailTransport {
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
