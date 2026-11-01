import { describe, expect, it } from "vitest";
import { trustedAuditIp } from "../src/lib/trusted-audit-source";

describe("phase C audit source", () => {
  it("ignores attacker-supplied forwarded chains", () => {
    const h = new Headers({ "x-forwarded-for": "8.8.8.8, 127.0.0.1", "x-real-ip": "192.0.2.20" });
    expect(trustedAuditIp(h)).toBe("192.0.2.20");
  });
  it("does not accept a comma-separated or invalid real IP", () => {
    const h = new Headers({ "x-real-ip": "127.0.0.1, 8.8.8.8" });
    expect(trustedAuditIp(h)).toBe("unknown");
  });
});
