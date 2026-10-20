import type { EmailTransport } from "../transport";
import { EmailDeliveryError } from "../transport";

export function createResendTransport(apiKey: string): EmailTransport {
  return {
    async send(message) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
          signal: AbortSignal.timeout(8_000),
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Provider rejected delivery");
      } catch {
        throw new EmailDeliveryError();
      }
    },
  };
}
