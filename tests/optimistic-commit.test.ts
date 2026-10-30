import { describe, expect, it, vi } from "vitest";
import { NonRetryableError, runOptimisticCommit } from "../src/lib/optimistic-commit";

function harness() {
  const state = { value: "before" };
  const notify = vi.fn();
  return {
    state,
    notify,
    options: (commit: () => Promise<string>, extra: object = {}) => ({
      apply: () => void (state.value = "after"),
      rollback: () => void (state.value = "before"),
      commit,
      onSuccess: () => void (state.value = "confirmed"),
      failureTitle: "Could not save",
      ...extra,
    }),
  };
}

describe("optimistic commit", () => {
  it("applies immediately and only confirms after the server acknowledges", async () => {
    const h = harness();
    let release: (v: string) => void = () => undefined;
    const done = runOptimisticCommit(
      new Set(),
      "k",
      h.options(() => new Promise<string>((r) => (release = r))),
      h.notify
    );
    expect(h.state.value).toBe("after");
    release("ok");
    expect(await done).toBe(true);
    expect(h.state.value).toBe("confirmed");
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("rolls back exactly and offers retry when the request fails", async () => {
    const h = harness();
    const inFlight = new Set<string>();
    const ok = await runOptimisticCommit(
      inFlight,
      "k",
      h.options(() => Promise.reject(new Error("offline"))),
      h.notify
    );
    expect(ok).toBe(false);
    expect(h.state.value).toBe("before");
    expect(inFlight.size).toBe(0);
    const [title, message, retry] = h.notify.mock.calls[0]!;
    expect(title).toBe("Could not save");
    expect(message).toBe("offline");
    expect(typeof retry).toBe("function");
  });

  it("does not offer retry for a stale-state conflict", async () => {
    const h = harness();
    await runOptimisticCommit(
      new Set(),
      "k",
      h.options(() => Promise.reject(new NonRetryableError("Changed elsewhere"))),
      h.notify
    );
    expect(h.notify.mock.calls[0]![2]).toBeNull();
  });

  it("ignores a duplicate activation while one is in flight", async () => {
    const h = harness();
    const inFlight = new Set<string>();
    let release: (v: string) => void = () => undefined;
    const first = runOptimisticCommit(
      inFlight,
      "k",
      h.options(() => new Promise<string>((r) => (release = r))),
      h.notify
    );
    const commit = vi.fn().mockResolvedValue("x");
    expect(await runOptimisticCommit(inFlight, "k", h.options(commit), h.notify)).toBe(false);
    expect(commit).not.toHaveBeenCalled();
    release("ok");
    await first;
  });

  it("retry re-applies and can then succeed", async () => {
    const h = harness();
    const commit = vi.fn().mockRejectedValueOnce(new Error("blip")).mockResolvedValueOnce("ok");
    await runOptimisticCommit(new Set(), "k", h.options(commit), h.notify);
    expect(h.state.value).toBe("before");
    (h.notify.mock.calls[0]![2] as () => void)();
    await vi.waitFor(() => expect(h.state.value).toBe("confirmed"));
    expect(commit).toHaveBeenCalledTimes(2);
  });
});
