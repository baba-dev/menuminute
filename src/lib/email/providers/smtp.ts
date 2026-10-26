import nodemailer from "nodemailer";
import { isIP } from "node:net";
import type { Transporter } from "nodemailer";
import type { EmailTransport, TransactionalEmail } from "../transport";
import { EmailDeliveryError } from "../transport";

export type SmtpTransportConfig = Readonly<{
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}>;

export type SmtpTimeouts = Readonly<{
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}>;

const defaultTimeouts: SmtpTimeouts = {
  connectionTimeout: 8_000,
  greetingTimeout: 5_000,
  socketTimeout: 10_000,
};

export function createSmtpTransport(
  config: SmtpTransportConfig,
  timeouts: SmtpTimeouts = defaultTimeouts
): EmailTransport {
  // Authentication mail volume is low. Pooling is intentionally disabled so a
  // failed/authenticated socket is never retained or silently reused.
  const client: Transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    pool: false,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: timeouts.connectionTimeout,
    greetingTimeout: timeouts.greetingTimeout,
    socketTimeout: timeouts.socketTimeout,
    tls: {
      ...(isIP(config.host) ? {} : { servername: config.host }),
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
    },
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  return {
    async send(message: TransactionalEmail) {
      try {
        await client.sendMail(message);
      } catch {
        // Do not expose Nodemailer errors: they can contain addresses, server
        // responses, message metadata or connection configuration.
        throw new EmailDeliveryError();
      }
    },
  };
}
