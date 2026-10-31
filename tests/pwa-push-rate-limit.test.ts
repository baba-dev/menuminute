import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimitError, UnavailableError } from "../src/lib/errors";

const { evalMock } = vi.hoisted(() => ({ evalMock: vi.fn() }));
vi.mock("../src/lib/redis", () => ({
  redisClient: vi.fn(async () => ({ eval: evalMock })),
}));

import { reservePushMutation } from "../src/modules/pwa/push-rate-limit";

describe("PWA H: bounded mutation limits", () => {
  beforeEach(() => {
    evalMock.mockReset();
    evalMock.mockResolvedValue(1);
  });

  it("reserves separate per-session, actor, outlet and global counters", async () => {
    await reservePushMutation({ userId: "user-1", sessionId: "session-1" }, "outlet-1");
    expect(evalMock).toHaveBeenCalledOnce();
    const [_lua, input] = evalMock.mock.calls[0] as [
      string,
      { keys: string[]; arguments: string[] },
    ];
    expect(input.keys).toHaveLength(4);
    expect(input.arguments).toEqual(["60", "12", "35", "200", "2000"]);
    expect(input.keys.every((key) => !key.includes("user-1") && !key.includes("session-1"))).toBe(
      true
    );
  });

  it("rejects abusive requests and fails closed when Redis cannot respond", async () => {
    evalMock.mockResolvedValueOnce(0);
    await expect(
      reservePushMutation({ userId: "x", sessionId: "y" }, "outlet")
    ).rejects.toBeInstanceOf(RateLimitError);
    evalMock.mockRejectedValueOnce(new Error("offline"));
    await expect(
      reservePushMutation({ userId: "x", sessionId: "y" }, "outlet")
    ).rejects.toBeInstanceOf(UnavailableError);
  });
});
