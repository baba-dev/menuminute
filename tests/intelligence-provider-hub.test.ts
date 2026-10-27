import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "../src/lib/config/env";
import { createProviderHub } from "../src/modules/intelligence";

const base = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://localhost/menuminute_test",
  AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  AUTH_ALLOW_TEST_EMAIL: "true",
  EMAIL_PROVIDER: "test",
  REDIS_QUEUE_URL: "redis://127.0.0.1:6379",
  REDIS_CACHE_URL: "redis://127.0.0.1:6380",
  MEDIA_STORAGE: "local",
  MEDIA_ROOT: "/tmp/menuminute-test-media",
};
const configured = (extra: Record<string, string> = {}) =>
  parseEnv({
    ...base,
    AI_FEATURES_ENABLED: "true",
    AI_ORCHESTRATOR_ENABLED: "true",
    AI_NVIDIA_ENABLED: "true",
    AI_NVIDIA_COMMERCIAL_APPROVED: "true",
    NVIDIA_API_KEY: "private-nvidia-key",
    AI_NVIDIA_MODEL: "reviewed/model",
    AI_CLOUDFLARE_ENABLED: "true",
    CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
    CLOUDFLARE_API_TOKEN: "private-cloudflare-key",
    AI_CLOUDFLARE_MODEL: "@cf/reviewed/model",
    ...extra,
  });
const completion = (message: unknown = { content: "A grounded answer" }, usage?: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message }],
      ...(usage ? { usage } : {}),
    }),
    { headers: { "content-type": "application/json" } }
  );
const user = [{ role: "user" as const, content: "Summarize the provided facts" }];
const tool = {
  name: "orders.summary",
  description: "Return authorized aggregated orders",
  parameters: { type: "object", properties: {}, additionalProperties: false },
};
describe("server-only provider hub", () => {
  it("stays inert by default and rejects unapproved or incomplete activation", async () => {
    const disabled = createProviderHub(parseEnv(base), vi.fn() as unknown as typeof fetch);
    expect(disabled.available()).toEqual([]);
    await expect(disabled.infer({ messages: user })).rejects.toMatchObject({ code: "disabled" });
    expect(() => configured({ AI_NVIDIA_COMMERCIAL_APPROVED: "false" })).toThrow();
    expect(() => configured({ AI_FEATURES_ENABLED: "false" })).toThrow();
    expect(() => configured({ AI_CLOUDFLARE_MODEL: "@cf/../bad" })).toThrow();
  });
  it("selects only approved models, keeps provider secrets out of payload and does not guess usage", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return completion();
    }) as unknown as typeof fetch;
    const hub = createProviderHub(configured(), fake);
    expect(hub.available()).toEqual([
      { provider: "nvidia", model: "reviewed/model", supportsTools: false },
      { provider: "cloudflare", model: "@cf/reviewed/model", supportsTools: false },
    ]);
    const response = await hub.infer({ messages: user });
    expect(response).toMatchObject({
      provider: "cloudflare",
      model: "@cf/reviewed/model",
      content: "A grounded answer",
      usage: { inputTokens: null, outputTokens: null, totalTokens: null },
    });
    expect(calls[0]!.url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/" + "a".repeat(32) + "/ai/v1/chat/completions"
    );
    expect(calls[0]!.init.headers).toMatchObject({
      Authorization: "Bearer private-cloudflare-key",
    });
    expect(calls[0]!.init.redirect).toBe("error");
    expect(JSON.stringify(calls[0]!.init.body)).not.toContain("private-cloudflare-key");
    expect(JSON.parse(String(calls[0]!.init.body)).stream).toBe(false);
    const nvidia = await hub.infer({ messages: user, provider: "nvidia" });
    expect(nvidia.provider).toBe("nvidia");
    expect(calls[1]!.url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
  });
  it("requires verified tool support and validates normalized calls without executing them", async () => {
    const fake = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: { name: "orders.summary", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
            usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 },
          }),
          { headers: { "content-type": "application/json" } }
        )
    ) as unknown as typeof fetch;
    const unverified = createProviderHub(configured(), fake);
    await expect(
      unverified.infer({ messages: user, capability: "tools", tools: [tool] })
    ).rejects.toMatchObject({ code: "unsupported_capability" });
    expect(fake).not.toHaveBeenCalled();
    const hub = createProviderHub(configured({ AI_NVIDIA_TOOLS_VERIFIED: "true" }), fake);
    const result = await hub.infer({ messages: user, capability: "tools", tools: [tool] });
    expect(result).toMatchObject({
      provider: "nvidia",
      content: null,
      toolCalls: [{ id: "call_1", name: "orders.summary", arguments: {} }],
      usage: { inputTokens: 12, outputTokens: 5, totalTokens: 17 },
    });
    expect(fake).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(
        String(
          (fake as unknown as { mock: { calls: Array<[unknown, RequestInit?]> } }).mock
            .calls[0]?.[1]?.body
        )
      ).tools[0].function.name
    ).toBe("orders.summary");
  });
  it("requires Cloudflare tool calls, maps scoped aliases, and completes a two-round exchange", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requests.push(payload);
      if (requests.length === 1)
        return new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call_cf_1",
                      type: "function",
                      function: { name: "orders_summary", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          }),
          { headers: { "content-type": "application/json" } }
        );
      return completion({ content: "There are 3 synthetic orders." });
    }) as unknown as typeof fetch;
    const hub = createProviderHub(
      configured({ AI_NVIDIA_ENABLED: "false", AI_CLOUDFLARE_TOOLS_VERIFIED: "true" }),
      fake
    );
    const first = await hub.infer({ messages: user, capability: "tools", tools: [tool] });
    expect(first.toolCalls).toEqual([{ id: "call_cf_1", name: "orders.summary", arguments: {} }]);
    expect(requests[0]).toMatchObject({
      tool_choice: "required",
      tools: [{ function: { name: "orders_summary" } }],
    });
    const final = await hub.infer({
      messages: [
        ...user,
        { role: "assistant", content: first.content, toolCalls: first.toolCalls },
        { role: "tool", toolCallId: "call_cf_1", content: '{"count":3}' },
      ],
      capability: "text",
    });
    expect(final).toMatchObject({ finishReason: "stop", content: "There are 3 synthetic orders." });
    expect(requests[1]).not.toHaveProperty("tool_choice");
    expect(requests[1]).not.toHaveProperty("tools");
    expect(requests[1]).toMatchObject({
      messages: [
        { role: "user" },
        { role: "assistant", content: "", tool_calls: [{ function: { name: "orders_summary" } }] },
        { role: "tool", tool_call_id: "call_cf_1" },
      ],
    });
    expect(fake).toHaveBeenCalledTimes(2);
  });

  it("retains NVIDIA null content for a tool-call replay while normalizing Cloudflare only", async () => {
    const payloads: Array<Record<string, unknown>> = [];
    const fake = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return completion();
    }) as unknown as typeof fetch;
    const hub = createProviderHub(configured(), fake);
    await hub.infer({
      provider: "nvidia",
      messages: [
        ...user,
        {
          role: "assistant",
          content: null,
          toolCalls: [{ id: "call_1", name: "orders.summary", arguments: {} }],
        },
        { role: "tool", toolCallId: "call_1", content: '{"count":2}' },
      ],
    });
    const messages = payloads[0]?.messages as Array<Record<string, unknown>>;
    expect(messages[1]?.content).toBeNull();
    expect(messages[1]?.tool_calls).toBeDefined();
  });

  it("rejects Cloudflare alias collisions before a call and rejects unapproved returned aliases", async () => {
    const bad = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "unauthorized",
                      type: "function",
                      function: { name: "admin_execute_sql", arguments: "{}" },
                    },
                  ],
                },
              },
            ],
          }),
          { headers: { "content-type": "application/json" } }
        )
    ) as unknown as typeof fetch;
    const hub = createProviderHub(
      configured({ AI_NVIDIA_ENABLED: "false", AI_CLOUDFLARE_TOOLS_VERIFIED: "true" }),
      bad
    );
    await expect(
      hub.infer({
        messages: user,
        capability: "tools",
        tools: [tool, { ...tool, name: "orders_summary" }],
      })
    ).rejects.toMatchObject({ code: "invalid_request" });
    expect(bad).not.toHaveBeenCalled();
    await expect(
      hub.infer({ messages: user, capability: "tools", tools: [tool] })
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(bad).toHaveBeenCalledTimes(1);
  });

  it("rejects fabricated or malformed tool outputs and oversized provider responses", async () => {
    const model = configured({ AI_NVIDIA_TOOLS_VERIFIED: "true" });
    const bad = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: "call1",
                      type: "function",
                      function: {
                        name: "admin.executeSql",
                        arguments: JSON.stringify({ sql: "select * from users" }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { headers: { "content-type": "application/json" } }
        )
    ) as unknown as typeof fetch;
    await expect(
      createProviderHub(model, bad).infer({ messages: user, capability: "tools", tools: [tool] })
    ).rejects.toMatchObject({ code: "invalid_response" });
    const huge = vi.fn(async () =>
      completion({ content: "x".repeat(256_001) })
    ) as unknown as typeof fetch;
    await expect(createProviderHub(model, huge).infer({ messages: user })).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it("classifies HTTP failures without leaking provider payload and never retries or fails over", async () => {
    const fake = vi.fn(
      async () => new Response("sensitive upstream details", { status: 429 })
    ) as unknown as typeof fetch;
    const hub = createProviderHub(configured(), fake);
    await expect(hub.infer({ messages: user })).rejects.toMatchObject({ code: "rate_limited" });
    expect(fake).toHaveBeenCalledTimes(1);
    expect(
      (fake as unknown as { mock: { calls: Array<[unknown, RequestInit?]> } }).mock.calls[0]?.[0]
    ).toContain("cloudflare");
    await expect(hub.infer({ messages: user, provider: "nvidia" })).rejects.toMatchObject({
      code: "rate_limited",
    });
    expect(fake).toHaveBeenCalledTimes(2);
  });
  it("validates prompt size, tools and pre-aborted signals before any network call", async () => {
    const fake = vi.fn() as unknown as typeof fetch;
    const hub = createProviderHub(configured(), fake);
    await expect(
      hub.infer({ messages: [{ role: "user", content: "x".repeat(16_001) }] })
    ).rejects.toMatchObject({ code: "invalid_request" });
    await expect(
      hub.infer({ messages: user, tools: [tool], capability: "text" })
    ).rejects.toMatchObject({ code: "invalid_request" });
    const controller = new AbortController();
    controller.abort();
    await expect(hub.infer({ messages: user, signal: controller.signal })).rejects.toMatchObject({
      code: "cancelled",
    });
    expect(fake).not.toHaveBeenCalled();
  });
});
