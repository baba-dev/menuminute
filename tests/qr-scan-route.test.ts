import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordQrScan: vi.fn(),
  reserveOrderCapability: vi.fn(),
  reserveOrderSource: vi.fn(),
  verifiedOrderSource: vi.fn(),
}));

vi.mock("@/modules/hospitality/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/hospitality/service")>();
  return { ...actual, recordQrScan: mocks.recordQrScan };
});
vi.mock("@/modules/orders/rate-limit", () => ({
  reserveOrderCapability: mocks.reserveOrderCapability,
  reserveOrderSource: mocks.reserveOrderSource,
  verifiedOrderSource: mocks.verifiedOrderSource,
}));

import { POST } from "../src/app/api/public-orders/scan/route";

const token = "table_token_123456";
const post = (body: string = JSON.stringify({ token }), origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/public-orders/scan", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body,
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifiedOrderSource.mockReturnValue("203.0.113.10");
  mocks.reserveOrderSource.mockResolvedValue(true);
  mocks.reserveOrderCapability.mockResolvedValue(true);
  mocks.recordQrScan.mockResolvedValue({ recorded: true });
});

describe("QR scan beacon route", () => {
  it("answers 204 and records the scan", async () => {
    const res = await POST(post());
    expect(res.status).toBe(204);
    expect(mocks.recordQrScan).toHaveBeenCalledWith({ token });
  });

  it("rejects a cross-origin request before touching limits or the database", async () => {
    const res = await POST(post(undefined, "https://evil.invalid"));
    expect(res.status).toBe(403);
    expect(mocks.reserveOrderSource).not.toHaveBeenCalled();
    expect(mocks.recordQrScan).not.toHaveBeenCalled();
  });

  it("returns 429 when the source or the QR allowance is exhausted", async () => {
    mocks.reserveOrderSource.mockResolvedValue(false);
    expect((await POST(post())).status).toBe(429);
    mocks.reserveOrderSource.mockResolvedValue(true);
    mocks.reserveOrderCapability.mockResolvedValue(false);
    expect((await POST(post())).status).toBe(429);
    expect(mocks.recordQrScan).not.toHaveBeenCalled();
  });

  it("returns 503 without recording when the edge identity is untrusted", async () => {
    mocks.verifiedOrderSource.mockImplementation(() => {
      throw new Error("untrusted");
    });
    expect((await POST(post())).status).toBe(503);
    expect(mocks.recordQrScan).not.toHaveBeenCalled();
  });
});
