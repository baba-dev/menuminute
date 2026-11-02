import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requestTableWater: vi.fn(),
  tableServiceState: vi.fn(),
  reserveOrderCapability: vi.fn(),
  reserveOrderSource: vi.fn(),
  verifiedOrderSource: vi.fn(),
}));

vi.mock("@/modules/hospitality/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/hospitality/service")>();
  return {
    ...actual,
    requestTableWater: mocks.requestTableWater,
    tableServiceState: mocks.tableServiceState,
  };
});
vi.mock("@/modules/orders/rate-limit", () => ({
  reserveOrderCapability: mocks.reserveOrderCapability,
  reserveOrderSource: mocks.reserveOrderSource,
  verifiedOrderSource: mocks.verifiedOrderSource,
}));

import { POST } from "../src/app/api/public-orders/water/route";
import { GET } from "../src/app/api/public-orders/table-service/route";

const token = "table_token_123456";
const post = (origin = "http://localhost:3000") =>
  new Request("http://localhost:3000/api/public-orders/water", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ token }),
  });
const get = () =>
  new Request(`http://localhost:3000/api/public-orders/table-service?token=${token}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifiedOrderSource.mockReturnValue("203.0.113.10");
  mocks.reserveOrderSource.mockResolvedValue(true);
  mocks.reserveOrderCapability.mockResolvedValue(true);
  mocks.requestTableWater.mockResolvedValue({ status: "requested", debounced: false });
  mocks.tableServiceState.mockResolvedValue({ water: true, request: null });
});

describe("guest water routes", () => {
  it("POST records a request for a same-origin, rate-allowed caller", async () => {
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(mocks.requestTableWater).toHaveBeenCalledWith({ token });
  });

  it("POST rejects cross-origin before touching limits or the database", async () => {
    const res = await POST(post("https://evil.invalid"));
    expect(res.status).toBe(403);
    expect(mocks.reserveOrderSource).not.toHaveBeenCalled();
    expect(mocks.requestTableWater).not.toHaveBeenCalled();
  });

  it("POST and GET return 429 when the allowance is exhausted", async () => {
    mocks.reserveOrderCapability.mockResolvedValue(false);
    expect((await POST(post())).status).toBe(429);
    expect((await GET(get())).status).toBe(429);
    expect(mocks.requestTableWater).not.toHaveBeenCalled();
    expect(mocks.tableServiceState).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the edge identity is untrusted", async () => {
    mocks.verifiedOrderSource.mockImplementation(() => {
      throw new Error("untrusted");
    });
    expect((await POST(post())).status).toBe(503);
    expect((await GET(get())).status).toBe(503);
  });

  it("GET returns the table service state without caching", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ water: true, request: null });
  });
});
