import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startDemoResetScheduler } from "../src/modules/demo/reset-scheduler";

describe("public demo reset scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T12:01:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never runs when the explicit demo kill switch is off", async () => {
    const run = vi.fn().mockResolvedValue({ seededOrders: 9 });
    const schedule = startDemoResetScheduler({
      enabled: false,
      run,
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(35 * 60_000);
    expect(run).not.toHaveBeenCalled();
    await schedule.close();
  });

  it("repairs at startup, realigns at each half-hour and closes cleanly", async () => {
    const run = vi.fn().mockResolvedValue({ seededOrders: 9 });
    const success = vi.fn();
    const schedule = startDemoResetScheduler({
      enabled: true,
      run,
      onSuccess: success,
      onFailure: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledTimes(2);
    await schedule.close();
    await vi.advanceTimersByTimeAsync(31 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("retries failures before the next reset rather than hiding them for thirty minutes", async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({ seededOrders: 9 });
    const failure = vi.fn();
    const success = vi.fn();
    const schedule = startDemoResetScheduler({
      enabled: true,
      run,
      onFailure: failure,
      onSuccess: success,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(failure).toHaveBeenCalledWith(expect.any(Error), 1, 60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenCalledTimes(1);
    await schedule.close();
  });

  it("never overlaps an in-flight reset with the next scheduled boundary", async () => {
    let finish: ((value: number) => void) | undefined;
    const run = vi.fn(() => new Promise<number>((resolve) => { finish = resolve; }));
    const schedule = startDemoResetScheduler({
      enabled: true,
      run,
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });
    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect(run).toHaveBeenCalledTimes(1);
    finish?.(1);
    await vi.advanceTimersByTimeAsync(0);
    await schedule.close();
  });
});
