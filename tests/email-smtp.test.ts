import net from "node:net";
import { SMTPServer } from "smtp-server";
import { afterEach, describe, expect, it } from "vitest";
import { createSmtpTransport } from "../src/lib/email/providers/smtp";

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()));
});

async function listen(server: SMTPServer) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  closers.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.server.address();
  if (!address || typeof address === "string") throw new Error("SMTP test server has no port");
  return address.port;
}

const message = {
  from: "food@bababuilds.com",
  to: "recipient@example.net",
  subject: "Verify your MenuMinute email",
  text: "Synthetic test message without a production token",
};

describe("SMTP transactional transport", () => {
  it("delivers through an isolated authenticated SMTP server with the configured sender", async () => {
    let envelopeSender = "";
    let received = false;
    const server = new SMTPServer({
      secure: false,
      disabledCommands: ["STARTTLS"],
      authOptional: false,
      onAuth(auth, _session, callback) {
        callback(
          auth.username === "food@bababuilds.com" && auth.password === "ci-only-password"
            ? null
            : new Error("Invalid credentials"),
          { user: auth.username }
        );
      },
      onMailFrom(address, _session, callback) {
        envelopeSender = address.address;
        callback();
      },
      onData(stream, _session, callback) {
        stream.on("data", () => undefined);
        stream.on("end", () => {
          received = true;
          callback();
        });
      },
    });
    const port = await listen(server);
    const transport = createSmtpTransport({
      host: "localhost",
      port,
      secure: false,
      user: "food@bababuilds.com",
      password: "ci-only-password",
    });

    await transport.send(message);
    expect(received).toBe(true);
    expect(envelopeSender).toBe("food@bababuilds.com");
  });

  it("sanitizes authentication and connection failures", async () => {
    const server = new SMTPServer({
      secure: false,
      disabledCommands: ["STARTTLS"],
      onAuth(_auth, _session, callback) {
        callback(new Error("server response includes ci-super-secret"));
      },
    });
    const port = await listen(server);
    const transport = createSmtpTransport({
      host: "localhost",
      port,
      secure: false,
      user: "food@bababuilds.com",
      password: "ci-super-secret",
    });

    await expect(transport.send(message)).rejects.toThrow("Authentication email delivery failed");
    await expect(transport.send(message)).rejects.not.toThrow(/secret|recipient|food@/i);
  });

  it("rejects an untrusted TLS certificate and times out a silent peer", async () => {
    const tlsServer = new SMTPServer({ secure: true, authOptional: true });
    // The expected client-side certificate rejection closes the TLS socket;
    // smtp-server reports that close as a server error.
    tlsServer.on("error", () => undefined);
    const tlsPort = await listen(tlsServer);
    const tlsTransport = createSmtpTransport({
      host: "localhost",
      port: tlsPort,
      secure: true,
      user: "ci-user",
      password: "ci-password",
    });
    await expect(tlsTransport.send(message)).rejects.toThrow(
      "Authentication email delivery failed"
    );

    const silentServer = net.createServer(() => undefined);
    await new Promise<void>((resolve) => silentServer.listen(0, "127.0.0.1", resolve));
    closers.push(() => new Promise<void>((resolve) => silentServer.close(() => resolve())));
    const address = silentServer.address();
    if (!address || typeof address === "string") throw new Error("Silent server has no port");
    const timeoutTransport = createSmtpTransport(
      {
        host: "localhost",
        port: address.port,
        secure: false,
        user: "ci-user",
        password: "ci-timeout-password",
      },
      { connectionTimeout: 100, greetingTimeout: 100, socketTimeout: 100 }
    );
    await expect(timeoutTransport.send(message)).rejects.toThrow(
      "Authentication email delivery failed"
    );
  });
});
