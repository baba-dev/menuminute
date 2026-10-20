import type { EmailTransport, TransactionalEmail } from "../transport";

const messages: TransactionalEmail[] = [];

export function createTestTransport(): EmailTransport {
  return {
    async send(message) {
      messages.push(message);
    },
  };
}

export function drainTestMessages() {
  return messages.splice(0);
}
