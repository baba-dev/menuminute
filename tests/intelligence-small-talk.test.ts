import { describe, expect, it, vi } from "vitest";
import { fixture } from "./helpers";
import { smallTalkReply } from "../src/modules/intelligence/small-talk";
import { beginTurn, createConversation } from "../src/modules/intelligence/store";
import { runReadOnlyTurn } from "../src/modules/intelligence/orchestrator";
import { createProviderHub } from "../src/modules/intelligence";
import { parseEnv } from "../src/lib/config/env";

describe("Ember small talk", () => {
  const tools = ["orders.pulse", "menu.summary", "help.search"];
  it("answers greetings, thanks and capability questions from authorized tools only", () => {
    expect(smallTalkReply("Hi!", tools)?.kind).toBe("greeting");
    expect(smallTalkReply("  Good morning Ember ", tools)?.kind).toBe("greeting");
    expect(smallTalkReply("thank you", tools)?.kind).toBe("thanks");
    const caps = smallTalkReply("What can you do?", tools)!;
    expect(caps.kind).toBe("capabilities");
    expect(caps.answer).toContain("today's orders");
    expect(caps.answer).not.toContain("till");
    expect(caps.answer).not.toMatch(/[a-z]+\.[a-z]+Pulse|orders\.pulse|JSON/i);
  });
  it("lists menu editing and publishing only when those tools are authorized", () => {
    const all = smallTalkReply("what can you do", ["menu.summary", "propose.menuPrice"])!.answer;
    expect(all).toContain("draft menu");
    expect(all).not.toContain("publish your menu");
    expect(
      smallTalkReply("what can you do", ["propose.menuPrice", "propose.menuPublish"])!.answer
    ).toContain("publish your menu");
  });
  it("never intercepts real questions and handles a role with no tools", () => {
    expect(smallTalkReply("hi, how many orders did we get today?", tools)).toBeNull();
    expect(smallTalkReply("Mark paneer as sold out", tools)).toBeNull();
    expect(smallTalkReply("x".repeat(200), tools)).toBeNull();
    expect(smallTalkReply("hello", [])?.answer).toContain("permissions");
  });
  it("completes a greeting turn with no provider call and no spend", async () => {
    const f = await fixture();
    const scope = {
      actor: f.actor,
      organizationId: f.outlet.organizationId,
      outletId: f.outlet.id,
    };
    const convo = await createConversation(scope, crypto.randomUUID());
    const start = await beginTurn(scope, convo.id, { key: crypto.randomUUID(), prompt: "hello" });
    const fake = vi.fn();
    const config = parseEnv({
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
      AI_FEATURES_ENABLED: "true",
      AI_ORCHESTRATOR_ENABLED: "true",
      AI_NVIDIA_ENABLED: "true",
      AI_NVIDIA_COMMERCIAL_APPROVED: "true",
      NVIDIA_API_KEY: "unit-test-only-key",
      AI_NVIDIA_MODEL: "reviewed/model",
      AI_NVIDIA_TOOLS_VERIFIED: "true",
    });
    const hub = createProviderHub(config, fake as unknown as typeof fetch);
    const result = await runReadOnlyTurn(scope, start.turn, hub, undefined, true, config);
    expect(result.status).toBe("completed");
    expect(result.answer).toContain("Ember");
    expect(fake).not.toHaveBeenCalled();
  });
});
