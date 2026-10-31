// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OperationalPwa } from "../src/components/pwa/operational-pwa";

describe("operational PWA safety", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it("locks the workspace through an outage and requires a reload after reconnection", async () => {
    render(
      <>
        <OperationalPwa workspace="POS" />
        <main>POS controls</main>
      </>
    );

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent("Connection lost");
    expect(document.querySelector("main")?.inert).toBe(true);

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event("online")));
    expect(await screen.findByRole("button", { name: "Reload and sync POS" })).toBeVisible();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("reload required");
  });

  it("requests and releases a wake lock only from a standalone user control", async () => {
    const release = vi.fn(async () => undefined);
    const sentinel = new EventTarget() as WakeLockSentinel;
    Object.defineProperties(sentinel, {
      released: { configurable: true, value: false },
      release: { configurable: true, value: release },
    });
    const request = vi.fn(async () => sentinel);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: { request },
    });

    render(<OperationalPwa workspace="Kitchen" />);
    fireEvent.click(await screen.findByRole("button", { name: "Keep screen awake" }));
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
    fireEvent.click(await screen.findByRole("button", { name: "Allow screen sleep" }));
    await waitFor(() => expect(release).toHaveBeenCalledOnce());
  });
});
