import { createECDH, createPublicKey, verify } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEnv } from "../src/lib/config/env";
import {
  allowedPushEndpoint,
  createVapidHeaders,
  pushEndpointHash,
  sendEmptyPush,
} from "../src/modules/pwa/vapid";

function keys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey().toString("base64url"),
    privateKey: ecdh.getPrivateKey().toString("base64url"),
  };
}

describe("PWA H: push service safety and signing", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "http://fcm.googleapis.com/fcm/send/a",
    "https://127.0.0.1/secret",
    "https://localhost/api/health/ready",
    "https://fcm.googleapis.com.evil.invalid/x",
    "https://user:pass@web.push.apple.com/x",
    "https://web.push.apple.com:8443/x",
    "https://web.push.apple.com/#fragment",
    "https://169.254.169.254/latest/meta-data/",
    "data:text/plain,test",
  ])("rejects an unsafe endpoint %s", (value) => {
    expect(allowedPushEndpoint(value)).toBe(false);
  });

  it.each([
    "https://fcm.googleapis.com/fcm/send/registration",
    "https://updates.push.services.mozilla.com/wpush/v2/registration",
    "https://web.push.apple.com/QP/registration",
    "https://wns2-par02p.notify.windows.com/?token=abc",
  ])("accepts a recognized HTTPS push service", (value) => {
    expect(allowedPushEndpoint(value)).toBe(true);
    expect(pushEndpointHash(value)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a verifiable, audience-bound and short-lived ES256 VAPID JWT", () => {
    const pair = keys();
    const endpoint = "https://web.push.apple.com/QP/registration";
    const result = createVapidHeaders(
      endpoint,
      pair.publicKey,
      pair.privateKey,
      "mailto:admin@bababuilds.com",
      Date.UTC(2026, 9, 31)
    );
    const jwt = result.Authorization.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(jwt).not.toBeNull();
    const encoded = (jwt?.[1] ?? "").split(".");
    expect(encoded).toHaveLength(3);
    expect(jwt?.[2]).toBe(pair.publicKey);
    const claims = JSON.parse(Buffer.from(encoded[1] ?? "", "base64url").toString("utf8")) as {
      aud: string;
      sub: string;
      exp: number;
    };
    expect(claims.aud).toBe("https://web.push.apple.com");
    expect(claims.sub).toBe("mailto:admin@bababuilds.com");
    expect(claims.exp).toBe(Math.floor(Date.UTC(2026, 9, 31) / 1000) + 12 * 3600);
    const pub = Buffer.from(pair.publicKey, "base64url");
    const key = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: pub.subarray(1, 33).toString("base64url"),
        y: pub.subarray(33, 65).toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from((encoded[0] ?? "") + "." + (encoded[1] ?? "")),
        { key, dsaEncoding: "ieee-p1363" },
        Buffer.from(encoded[2] ?? "", "base64url")
      )
    ).toBe(true);
    expect(() =>
      createVapidHeaders(endpoint, pair.publicKey, keys().privateKey, "mailto:admin@bababuilds.com")
    ).toThrow("mismatch");
  });

  it("sends no personal payload and classifies permanent vs retryable failures", async () => {
    const pair = keys();
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const config = {
      ...pair,
      subject: "mailto:admin@bababuilds.com",
    };
    expect(await sendEmptyPush(endpoint, config)).toBe("accepted");
    const [sentUrl, sentOptions] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(sentUrl).toBe(endpoint);
    expect(sentOptions.method).toBe("POST");
    expect(sentOptions).not.toHaveProperty("body");
    expect(sentOptions.redirect).toBe("error");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 410 }));
    expect(await sendEmptyPush(endpoint, config)).toBe("gone");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect(await sendEmptyPush(endpoint, config)).toBe("retry");
    expect(await sendEmptyPush("https://127.0.0.1/", config)).toBe("gone");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("fails closed without an allowlist, contact subject and VAPID secrets", () => {
    expect(() =>
      parseEnv({
        ...process.env,
        PWA_PUSH_ENABLED: "true",
        PWA_PUSH_OUTLET_IDS: "",
        PWA_PUSH_VAPID_PUBLIC_KEY: "",
        PWA_PUSH_VAPID_PRIVATE_KEY: "",
        PWA_PUSH_VAPID_SUBJECT: "",
      })
    ).toThrow(/PWA_PUSH/);
    expect(() =>
      parseEnv({
        ...process.env,
        PWA_PUSH_ENABLED: "true",
        PWA_PUSH_OUTLET_IDS: "outlet-A,outlet-A",
      })
    ).toThrow(/PWA_PUSH_OUTLET_IDS/);
    const config = parseEnv({
      ...process.env,
      PWA_PUSH_ENABLED: "false",
      PWA_PUSH_OUTLET_IDS: "",
      PWA_PUSH_VAPID_PUBLIC_KEY: undefined,
      PWA_PUSH_VAPID_PRIVATE_KEY: undefined,
      PWA_PUSH_VAPID_SUBJECT: undefined,
    });
    expect(config.PWA_PUSH_ENABLED).toBe(false);
    const blanks = parseEnv({
      ...process.env,
      PWA_PUSH_ENABLED: "false",
      PWA_PUSH_OUTLET_IDS: "",
      PWA_PUSH_VAPID_PUBLIC_KEY: "",
      PWA_PUSH_VAPID_PRIVATE_KEY: "",
      PWA_PUSH_VAPID_SUBJECT: "",
    });
    expect(blanks.PWA_PUSH_ENABLED).toBe(false);
    expect(blanks.PWA_PUSH_VAPID_PUBLIC_KEY).toBeUndefined();
  });

  it("keeps database and worker boundaries visible for migration/security review", async () => {
    const sql = await readFile(
      new URL("../src/db/migrations/0058_pwa_push.sql", import.meta.url),
      "utf8"
    );
    expect(sql).toContain("REFERENCES sessions(id) ON DELETE CASCADE");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION app_private.pwa_push_claim(text[]) TO menuminute_worker"
    );
    expect(sql).toContain("s.expires_at>now()");
    expect(sql).toContain("EXCEPTION WHEN OTHERS");
    expect(sql).toContain("app_private.kitchen_access(p_outlet)");
    expect(sql).toContain("JOIN kitchen_work kw");
    expect(sql).toContain("m.is_active");
    expect(sql).toContain("p_outlet IS DISTINCT FROM current_setting('app.outlet_id',true)");
    expect(sql).toContain("REVOKE ALL ON pwa_push_subscriptions,pwa_push_deliveries");
    const sw = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
    expect(sw).toContain('self.addEventListener("push"');
    expect(sw).toContain('self.addEventListener("notificationclick"');
    expect(sw).not.toMatch(/addEventListener\(["']sync["']/);
    expect(sw).not.toMatch(/event\.data\.json\(\)/);
  });
});
