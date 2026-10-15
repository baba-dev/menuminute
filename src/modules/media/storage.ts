import { createHash, createHmac } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
const hash = (v: Buffer | string) => createHash("sha256").update(v).digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value).digest();
function keyPath(key: string) {
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/(?:original|display\.webp|thumb\.webp)$/.test(key))
    throw new Error("Invalid storage key");
  return key;
}
function root() {
  const value = process.env["MEDIA_ROOT"];
  if (!value || !path.isAbsolute(value)) throw new Error("Explicit absolute media root required");
  return value;
}
async function r2(method: "GET" | "PUT", key: string, body?: Buffer) {
  const endpoint = process.env["R2_ENDPOINT"],
    bucket = process.env["R2_BUCKET_NAME"],
    access = process.env["R2_ACCESS_KEY_ID"],
    secret = process.env["R2_SECRET_ACCESS_KEY"];
  if (!endpoint || !bucket || !access || !secret) throw new Error("R2 configuration incomplete");
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".r2.cloudflarestorage.com") ||
    url.username ||
    url.password ||
    url.search ||
    url.pathname !== "/"
  )
    throw new Error("R2 endpoint must be a canonical account HTTPS endpoint");
  url.pathname = `/${encodeURIComponent(bucket)}/${keyPath(key).split("/").map(encodeURIComponent).join("/")}`;
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = now.slice(0, 8);
  const digest = hash(body ?? "");
  const signed = "host;x-amz-content-sha256;x-amz-date";
  const canonical = [
    method,
    url.pathname,
    "",
    `host:${url.host}\nx-amz-content-sha256:${digest}\nx-amz-date:${now}\n`,
    signed,
    digest,
  ].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const toSign = `AWS4-HMAC-SHA256\n${now}\n${scope}\n${hash(canonical)}`;
  const signing = hmac(hmac(hmac(hmac("AWS4" + secret, day), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signing).update(toSign).digest("hex");
  const response = await fetch(url, {
    method,
    headers: {
      "x-amz-content-sha256": digest,
      "x-amz-date": now,
      authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
      ...(method === "PUT"
        ? { "content-type": key.endsWith(".webp") ? "image/webp" : "application/octet-stream" }
        : {}),
    },
    body: body ? new Uint8Array(body) : undefined,
    signal: AbortSignal.timeout(15000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Object storage unavailable");
  if (method === "PUT") return Buffer.alloc(0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing object");
  let size = 0;
  const parts: Buffer[] = [];
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > 5242880) throw new Error("Stored object exceeds limit");
      parts.push(Buffer.from(r.value));
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(parts);
}
export async function putObject(key: string, body: Buffer) {
  keyPath(key);
  if (process.env["MEDIA_STORAGE"] === "r2") {
    await r2("PUT", key, body);
    return;
  }
  const file = path.join(root(), key);
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + "." + crypto.randomUUID() + ".tmp";
  try {
    await fs.writeFile(temporary, body, { flag: "wx", mode: 0o600 });
    await fs.rename(temporary, file);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}
export async function getObject(key: string) {
  keyPath(key);
  if (process.env["MEDIA_STORAGE"] === "r2") return r2("GET", key);
  const file = path.join(root(), key);
  const info = await fs.stat(file);
  if (info.size > 5242880) throw new Error("Stored object exceeds limit");
  return fs.readFile(file);
}
