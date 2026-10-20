export type TransactionalEmail = Readonly<{
  from: string;
  to: string;
  subject: string;
  text: string;
}>;

export interface EmailTransport {
  send(message: TransactionalEmail): Promise<void>;
}

/** Public error text is deliberately provider-, recipient- and secret-free. */
export class EmailDeliveryError extends Error {
  constructor() {
    super("Authentication email delivery failed");
    this.name = "EmailDeliveryError";
  }
}
