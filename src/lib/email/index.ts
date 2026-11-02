import { env } from "@/lib/config/env";
import { createEmailTransport } from "./factory";
import type { EmailTransport, TransactionalEmail } from "./transport";

export { createEmailTransport } from "./factory";

let transport: EmailTransport | undefined;

export async function sendTransactionalEmail(message: Omit<TransactionalEmail, "from">) {
  transport ??= createEmailTransport(env);
  await transport.send({ ...message, from: env.EMAIL_FROM ?? "test@localhost.invalid" });
}

export { EmailDeliveryError } from "./transport";
