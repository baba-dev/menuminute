import { createECDH, createPrivateKey, createHash, sign } from "node:crypto";

/** Empty-payload RFC 8030 Web Push. Notification content is generated locally by the SW. */
export function allowedPushEndpoint(input: string) {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash)
      return false;
    return (
      url.hostname === "fcm.googleapis.com" ||
      url.hostname === "updates.push.services.mozilla.com" ||
      url.hostname === "web.push.apple.com" ||
      /^(?:[a-z0-9-]+\.)+notify\.windows\.com$/.test(url.hostname)
    );
  } catch {
    return false;
  }
}

export function pushEndpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

/** ES256 VAPID signing, no dependency or client-readable private key. */
export function createVapidHeaders(
  endpoint: string,
  publicKey: string,
  privateKey: string,
  subject: string,
  now = Date.now()
) {
  if (!allowedPushEndpoint(endpoint)) throw new Error("Unsupported push service endpoint");
  if (!/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/.test(subject))
    throw new Error("VAPID subject must be mailto:contact@example.com");
  const pub = Buffer.from(publicKey, "base64url");
  const priv = Buffer.from(privateKey, "base64url");
  if (pub.length !== 65 || pub[0] !== 4 || priv.length !== 32)
    throw new Error("Invalid P-256 VAPID key length");
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(priv);
  if (!ecdh.getPublicKey().equals(pub)) throw new Error("VAPID public/private key mismatch");
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33, 65).toString("base64url"),
      d: priv.toString("base64url"),
    },
    format: "jwk",
  });
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(now / 1000) + 12 * 60 * 60,
      sub: subject,
    })
  ).toString("base64url");
  const input = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(input), {
    key,
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");
  return {
    Authorization: `vapid t=${input}.${signature}, k=${publicKey}`,
    TTL: "90",
    Urgency: "normal",
  };
}

export async function sendEmptyPush(
  endpoint: string,
  keys: { publicKey: string; privateKey: string; subject: string }
): Promise<"accepted" | "gone" | "retry" | "failed"> {
  if (!allowedPushEndpoint(endpoint)) return "gone";
  try {
    const headers = createVapidHeaders(endpoint, keys.publicKey, keys.privateKey, keys.subject);
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 201 || response.status === 202) return "accepted";
    if (response.status === 404 || response.status === 410) return "gone";
    if (response.status === 408 || response.status === 429 || response.status >= 500)
      return "retry";
    return "failed";
  } catch {
    // A timeout must never imply that the device received an order.
    return "retry";
  }
}
