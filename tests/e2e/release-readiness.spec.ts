import { expect, test } from "@playwright/test";

test("built release readiness is healthy and identifies the exact CI source", async ({
  request,
}) => {
  const response = await request.get("/api/health/ready");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.status).toBe("ready");
  expect(body.database).toBe(true);
  expect(body.redis.queue).toBe(true);
  expect(body.redis.cache).toBe(true);
  expect(body.media).toBe(true);
  if (process.env.GITHUB_SHA) {
    expect(body.release).toBe(process.env.GITHUB_SHA);
  }
});
