import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callGuestService: vi.fn(),
  guestServiceState: vi.fn(),
  publicProduct: vi.fn(),
  reserveOrderCapability: vi.fn(),
  reserveOrderSource: vi.fn(),
  verifiedOrderSource: vi.fn(),
}));

vi.mock("@/modules/hospitality/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/hospitality/service")>();
  return {
    ...actual,
    callGuestService: mocks.callGuestService,
    guestServiceState: mocks.guestServiceState,
  };
});
vi.mock("@/modules/menu-product/service", () => ({
  publicProduct: mocks.publicProduct,
}));
vi.mock("@/modules/orders/rate-limit", () => ({
  reserveOrderCapability: mocks.reserveOrderCapability,
  reserveOrderSource: mocks.reserveOrderSource,
  verifiedOrderSource: mocks.verifiedOrderSource,
}));

import {
  GET as serviceGET,
  POST as servicePOST,
} from "../src/app/api/public-orders/[orderId]/service-call/route";
import { GET as menuGET } from "../src/app/api/public-menu/[token]/route";

const orderContext = { params: Promise.resolve({ orderId: "order_test_123" }) };
const menuContext = { params: Promise.resolve({ token: "menu_token_123" }) };
const source = "203.0.113.10";
const body = {
  token: "menu_token_123",
  trackingToken: "tracking_token_123",
  signal: "call_server",
} as const;

function serviceRequest(
  requestBody: string = JSON.stringify(body),
  origin = "http://localhost:3000"
) {
  return new Request("http://localhost:3000/api/public-orders/order_test_123/service-call", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: requestBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifiedOrderSource.mockReturnValue(source);
  mocks.reserveOrderSource.mockResolvedValue(true);
  mocks.reserveOrderCapability.mockResolvedValue(true);
  mocks.callGuestService.mockResolvedValue({ status: "requested", debounced: false });
  mocks.guestServiceState.mockResolvedValue([]);
  mocks.publicProduct.mockResolvedValue({ id: "menu-product" });
});

describe("guest service-call guards", () => {
  it("rejects cross-origin mutations before reserving capacity or calling the service", async () => {
    const response = await servicePOST(
      serviceRequest(undefined, "https://evil.invalid"),
      orderContext
    );

    expect(response.status).toBe(403);
    expect(mocks.verifiedOrderSource).not.toHaveBeenCalled();
    expect(mocks.reserveOrderSource).not.toHaveBeenCalled();
    expect(mocks.callGuestService).not.toHaveBeenCalled();
  });

  it("returns 429 when the verified source allowance is exhausted", async () => {
    mocks.reserveOrderSource.mockResolvedValue(false);

    const response = await servicePOST(serviceRequest(), orderContext);

    expect(response.status).toBe(429);
    expect(mocks.reserveOrderSource).toHaveBeenCalledWith("tracking", source);
    expect(mocks.reserveOrderCapability).not.toHaveBeenCalled();
    expect(mocks.callGuestService).not.toHaveBeenCalled();
  });

  it("rejects bodies over 4096 bytes before capability or service work", async () => {
    const response = await servicePOST(serviceRequest("x".repeat(4097)), orderContext);

    expect(response.status).toBe(413);
    expect(mocks.reserveOrderCapability).not.toHaveBeenCalled();
    expect(mocks.callGuestService).not.toHaveBeenCalled();
  });

  it("applies the capability allowance to service-call reads and writes", async () => {
    mocks.reserveOrderCapability.mockResolvedValue(false);

    const postResponse = await servicePOST(serviceRequest(), orderContext);
    const getResponse = await serviceGET(
      new Request(
        "http://localhost:3000/api/public-orders/order_test_123/service-call?token=menu_token_123",
        { headers: { "x-tracking-token": "tracking_token_123" } }
      ),
      orderContext
    );

    expect(postResponse.status).toBe(429);
    expect(getResponse.status).toBe(429);
    expect(mocks.reserveOrderCapability).toHaveBeenNthCalledWith(1, "tracking", source, body.token);
    expect(mocks.reserveOrderCapability).toHaveBeenNthCalledWith(2, "tracking", source, body.token);
    expect(mocks.callGuestService).not.toHaveBeenCalled();
    expect(mocks.guestServiceState).not.toHaveBeenCalled();
  });

  it("passes the bounded, validated request to the service after both reservations", async () => {
    const response = await servicePOST(serviceRequest(), orderContext);

    expect(response.status).toBe(200);
    expect(mocks.reserveOrderSource).toHaveBeenCalledWith("tracking", source);
    expect(mocks.reserveOrderCapability).toHaveBeenCalledWith("tracking", source, body.token);
    expect(mocks.callGuestService).toHaveBeenCalledWith("order_test_123", body);
  });
});

describe("public menu source guard", () => {
  it("returns 429 before resolving the menu when the source allowance is exhausted", async () => {
    mocks.reserveOrderSource.mockResolvedValue(false);

    const response = await menuGET(
      new Request("http://localhost:3000/api/public-menu/menu_token_123"),
      menuContext
    );

    expect(response.status).toBe(429);
    expect(mocks.reserveOrderSource).toHaveBeenCalledWith("tracking", source);
    expect(mocks.publicProduct).not.toHaveBeenCalled();
  });

  it("fails closed before menu lookup when proxy attestation is unavailable", async () => {
    mocks.verifiedOrderSource.mockImplementation(() => {
      throw new Error("untrusted source");
    });

    const response = await menuGET(
      new Request("http://localhost:3000/api/public-menu/menu_token_123"),
      menuContext
    );

    expect(response.status).toBe(503);
    expect(mocks.reserveOrderSource).not.toHaveBeenCalled();
    expect(mocks.publicProduct).not.toHaveBeenCalled();
  });
});
