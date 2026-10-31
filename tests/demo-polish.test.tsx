// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { DemoBanner } from "../src/components/demo/demo-banner";
import { DEMO_RESET_INTERVAL_MS, nextDemoResetAt } from "../src/modules/demo/ids";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("demo reset schedule", () => {
  it("resets on wall-clock half hours and always lies in the future", () => {
    const base = Date.UTC(2026, 9, 31, 10, 0, 0);
    expect(nextDemoResetAt(base)).toBe(base + DEMO_RESET_INTERVAL_MS);
    expect(nextDemoResetAt(base + 1)).toBe(base + DEMO_RESET_INTERVAL_MS);
    expect(nextDemoResetAt(base + DEMO_RESET_INTERVAL_MS - 1)).toBe(base + DEMO_RESET_INTERVAL_MS);
    expect(nextDemoResetAt(base + DEMO_RESET_INTERVAL_MS)).toBe(base + 2 * DEMO_RESET_INTERVAL_MS);
    // Boundaries are :00 and :30 in IST (UTC+5:30) as well.
    expect((nextDemoResetAt(base) + 330 * 60000) % DEMO_RESET_INTERVAL_MS).toBe(0);
  });
});

describe("DemoBanner", () => {
  it("shows a live countdown to the next reset and is labelled for assistive tech", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 31, 10, 17, 30)));
    render(<DemoBanner />);
    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole("region", { name: "Public demo notice" })).toBeTruthy();
    expect(screen.getByText("12:30")).toBeTruthy(); // 10:17:30 → 10:30:00 is 12 min 30 s
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("11:30")).toBeTruthy();
  });
  it("offers a refresh just after the boundary instead of a stale countdown", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 9, 31, 10, 30, 10)));
    render(<DemoBanner />);
    await act(async () => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.getByRole("button", { name: /refresh/i })).toBeTruthy();
    expect(screen.queryByText(/next reset in/)).toBeNull();
  });
});
