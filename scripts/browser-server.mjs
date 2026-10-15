// Local test-only TLS proxy exercises the built standalone server, including Secure cookies.
import https from "node:https";
import http from "node:http";
import { mkdtemp, readFile, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
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
const { MIGRATION_DATABASE_URL: ownerUrl, ...runtimeEnv } = process.env;
void ownerUrl;
const backend = spawn(process.execPath, [".next/standalone/server.js"], {
  stdio: "inherit",
  env: {
    ...runtimeEnv,
    NODE_ENV: "production",
    APP_URL: "https://localhost:3443",
    AUTH_SECRET: "31724fb63d1f828e2c6ac702d77a13be9a1f7d41f592804bc",
    PORT: "3100",
    HOSTNAME: "127.0.0.1",
  },
});
const server = https.createServer(
  {
    key: await readFile(path.join(dir, "key.pem")),
    cert: await readFile(path.join(dir, "cert.pem")),
  },
  (req, res) => {
    const forwarded = http.request(
      {
        hostname: "127.0.0.1",
        port: 3100,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-for": "127.0.0.1" },
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
