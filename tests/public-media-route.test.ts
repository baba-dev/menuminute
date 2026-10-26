import { beforeEach, expect, it, vi } from "vitest";

const { mediaResponse, consumeLimit } = vi.hoisted(() => ({
  mediaResponse: vi.fn(),
  consumeLimit: vi.fn(),
}));

vi.mock("../src/modules/media/product-service", () => ({
  publicMediaResponse: mediaResponse,
}));
vi.mock("../src/lib/public-rate-limit", () => ({
  consumePublicMediaLimit: consumeLimit,
  publicClientIdentity: () => "test-client",
}));

import { GET } from "../src/app/api/public-media/[mediaId]/route";

const context = { params: Promise.resolve({ mediaId: "media-test" }) };

beforeEach(() => {
  mediaResponse.mockReset();
  consumeLimit.mockReset();
  consumeLimit.mockResolvedValue({
    allowed: true,
    limit: 180,
    remaining: 179,
    retryAfterSeconds: 60,
  });
});

it("returns a private revalidating ETag and avoids a body after authorization on 304", async () => {
  mediaResponse.mockResolvedValue({ etag: '"validator"', notModified: true });
  const response = await GET(
    new Request("https://menu.invalid/api/public-media/media-test", {
      headers: { "if-none-match": 'W/"validator"', "x-forwarded-for": "192.0.2.10" },
    }),
    context
  );
  expect(response.status).toBe(304);
  expect(response.headers.get("cache-control")).toBe(
    "private, no-cache, max-age=0, must-revalidate"
  );
  expect(response.headers.get("etag")).toBe('"validator"');
  expect(mediaResponse).toHaveBeenCalledWith("media-test", false, 'W/"validator"');
});

it("returns rate-limit and dependency failures without querying media authorization", async () => {
  consumeLimit.mockResolvedValueOnce({
    allowed: false,
    limit: 180,
    remaining: 0,
    retryAfterSeconds: 37,
  });
  const limited = await GET(
    new Request("https://menu.invalid/api/public-media/media-test"),
    context
  );
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("37");
  expect(limited.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  expect(mediaResponse).not.toHaveBeenCalled();

  consumeLimit.mockRejectedValueOnce(new Error("redis unavailable"));
  const unavailable = await GET(
    new Request("https://menu.invalid/api/public-media/media-test"),
    context
  );
  expect(unavailable.status).toBe(503);
  expect(mediaResponse).not.toHaveBeenCalled();
});
