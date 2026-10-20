import { createHash } from "node:crypto";
// Local test-only TLS proxy exercises the built standalone server, including Secure cookies.
import https from "node:https";
import http from "node:http";
import { mkdtemp, readFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { SMTPServer } from "smtp-server";
const dir = await mkdtemp(path.join(tmpdir(), "menuminute-browser-tls-"));
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    path.join(dir, "key.pem"),
    "-out",
    path.join(dir, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost",
  ],
  { stdio: "ignore" }
);
await cp("public", ".next/standalone/public", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const tlsKey = await readFile(path.join(dir, "key.pem"));
const tlsCertificate = await readFile(path.join(dir, "cert.pem"));
const smtpServer = new SMTPServer({
  secure: true,
  key: tlsKey,
  cert: tlsCertificate,
  authOptional: false,
  onAuth(auth, _session, callback) {
    callback(
      auth.username === "browser-ci" && auth.password === "browser-ci-password"
        ? null
        : new Error("Invalid CI SMTP credentials"),
      { user: auth.username }
    );
  },
  onData(stream, _session, callback) {
    stream.on("data", () => undefined);
    stream.on("end", callback);
  },
});
await new Promise((resolve, reject) => {
  smtpServer.once("error", reject);
  smtpServer.listen(2465, "127.0.0.1", () => {
    smtpServer.off("error", reject);
    resolve();
  });
});
const {
  MIGRATION_DATABASE_URL: ownerUrl,
  WORKER_DATABASE_URL: workerUrl,
  ...runtimeEnv
} = process.env;
void ownerUrl;
void workerUrl;
const backend = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...runtimeEnv,
    NODE_ENV: "production",
    APP_URL: "https://localhost:3443",
    AUTH_SECRET: "31724fb63d1f828e2c6ac702d77a13be9a1f7d41f592804bc",
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: "food@bababuilds.com",
    SMTP_HOST: "localhost",
    SMTP_PORT: "2465",
    SMTP_SECURE: "true",
    SMTP_USER: "browser-ci",
    SMTP_PASSWORD: "browser-ci-password",
    // Also gates the established localhost/menuminute_test-only MFA fixture bypass.
    AUTH_ALLOW_TEST_EMAIL: "true",
    NODE_EXTRA_CA_CERTS: path.join(dir, "cert.pem"),
    PORT: "3100",
    HOSTNAME: "127.0.0.1",
  },
});
const mediaWorker = spawn(process.execPath, ["dist/worker.mjs"], {
  stdio: "inherit",
  env: {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    WORKER_DATABASE_URL: workerUrl,
    REDIS_QUEUE_URL: process.env.REDIS_QUEUE_URL,
    MEDIA_ROOT: process.env.MEDIA_ROOT,
    MEDIA_STORAGE: "local",
  },
});
const server = https.createServer(
  {
    key: tlsKey,
    cert: tlsCertificate,
  },
  (req, res) => {
    const forwarded = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          "x-forwarded-proto": "https",
          "x-forwarded-for": /^[a-f0-9-]{36}$/.test(
            String(req.headers["x-browser-test-client"] ?? "")
          )
            ? "198.18." +
              Number.parseInt(
                createHash("sha256")
                  .update(String(req.headers["x-browser-test-client"]))
                  .digest("hex")
                  .slice(0, 2),
                16
              ) +
              "." +
              Number.parseInt(
                createHash("sha256")
                  .update(String(req.headers["x-browser-test-client"]))
                  .digest("hex")
                  .slice(2, 4),
                16
              )
            : "127.0.0.1",
        },
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      }
    );
    forwarded.on("error", () => {
      res.writeHead(503);
      res.end("Starting");
    });
    req.pipe(forwarded);
  }
);
server.listen(3443, "127.0.0.1");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  backend.kill("SIGTERM");
  mediaWorker.kill("SIGTERM");
  smtpServer.close();
  server.close();
  await rm(dir, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
backend.on("exit", (code) => {
  if (!stopping) {
    console.error("Standalone browser server exited", code);
    void stop();
  }
});
