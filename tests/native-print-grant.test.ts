import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  sessionRows: 1,
  outlets: [{ id: "out1", organizationId: "org1", name: "Spice", timezone: "UTC" }] as Array<{
    id: string;
    organizationId: string;
    name: string;
    timezone: string;
  }>,
  receipt: { issuedDocumentId: null as string | null },
  posReceipt: vi.fn(),
}));

vi.mock("@/lib/config/env", () => ({
  env: { AUTH_SECRET: "isolated-test-key-with-at-least-32-characters" },
}));
vi.mock("@/db", () => ({
  getPool: () => ({ query: async () => ({ rowCount: state.sessionRows }) }),
}));
vi.mock("@/modules/pos/service", () => ({ posReceipt: state.posReceipt }));
vi.mock("@/modules/restaurants/service", () => ({
  getRestaurantsByUserId: async () => state.outlets,
  getDefaultOrActiveRestaurant: async () => state.outlets[0],
}));
vi.mock("@/modules/pos/thermal-view", () => ({ buildThermalReceipt: () => ({}) }));
vi.mock("@/lib/pos/thermal-receipt", () => ({
  encodeThermalReceipt: (_: unknown, paper: string) => new Uint8Array([0x1b, 0x40, Number(paper)]),
}));

import {
  NATIVE_PRINT_GRANT_TTL_SECONDS,
  mintNativePrintGrant,
  redeemNativePrintGrant,
  verifyNativePrintGrant,
} from "../src/modules/pos/native-print";

const scope = {
  uid: "u1",
  sid: "s1",
  org: "org1",
  out: "out1",
  sale: "sale1",
  paper: "80" as const,
};

beforeEach(() => {
  state.sessionRows = 1;
  state.outlets = [{ id: "out1", organizationId: "org1", name: "Spice", timezone: "UTC" }];
  state.receipt = { issuedDocumentId: null };
  state.posReceipt.mockReset();
  state.posReceipt.mockImplementation(async () => state.receipt);
});

describe("native print grant", () => {
  it("round-trips a scoped grant that expires after two minutes", () => {
    const now = 1_800_000_000_000;
    const { grant, expiresAt } = mintNativePrintGrant(scope, now);
    expect(NATIVE_PRINT_GRANT_TTL_SECONDS).toBe(120);
    expect(new Date(expiresAt).getTime()).toBe(now + 120_000);
    expect(verifyNativePrintGrant(grant, now + 119_000)).toMatchObject(scope);
    expect(() => verifyNativePrintGrant(grant, now + 120_000)).toThrow();
  });

  it("rejects tampered, re-signed, truncated and malformed grants", () => {
    const { grant } = mintNativePrintGrant(scope);
    const [body, sig] = grant.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64url").toString()), sale: "other" })
    ).toString("base64url");
    for (const bad of [
      `${forged}.${sig}`,
      `${body}.${sig!.slice(0, -2)}AA`,
      `${body}`,
      `${body}.${sig}.extra`,
      "",
      "a.b",
      42,
      null,
    ])
      expect(() => verifyNativePrintGrant(bad)).toThrow();
  });

  it("redeems to ESC/POS bytes only while the session is live and membership current", async () => {
    const { grant } = mintNativePrintGrant(scope);
    expect(Array.from(await redeemNativePrintGrant(grant))).toEqual([0x1b, 0x40, 80]);
    expect(state.posReceipt).toHaveBeenCalledWith(
      { userId: "u1", sessionId: "s1" },
      "org1",
      "out1",
      "sale1"
    );

    state.sessionRows = 0; // signed out / revoked
    await expect(redeemNativePrintGrant(grant)).rejects.toThrow();
    state.sessionRows = 1;

    state.outlets = []; // membership removed after minting
    await expect(redeemNativePrintGrant(grant)).rejects.toThrow();
    state.outlets = [{ id: "out1", organizationId: "org1", name: "Spice", timezone: "UTC" }];

    state.receipt = { issuedDocumentId: "doc1" }; // fiscal documents never print from here
    await expect(redeemNativePrintGrant(grant)).rejects.toThrow();
  });
});
