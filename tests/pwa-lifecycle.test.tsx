// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PwaLifecycle } from "../src/components/pwa/pwa-lifecycle";

class InstallPromptEvent extends Event {
  prompt = vi.fn(async () => undefined);
  userChoice = Promise.resolve({ outcome: "accepted" as const, platform: "web" });
}

describe("PWA lifecycle UI", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(navigator, "platform", { configurable: true, value: "Linux" });
  });

  it("offers and invokes the browser install prompt", async () => {
    render(<PwaLifecycle />);
    const prompt = new InstallPromptEvent("beforeinstallprompt", { cancelable: true });
    act(() => window.dispatchEvent(prompt));

    fireEvent.click(await screen.findByRole("button", { name: "Install app" }));
    await waitFor(() => expect(prompt.prompt).toHaveBeenCalledOnce());
  });

  it("announces loss and restoration of connectivity", async () => {
    render(<PwaLifecycle />);
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event("offline")));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Live actions and ordering are unavailable"
    );

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("remembers an install dismissal instead of repeatedly interrupting", async () => {
    render(<PwaLifecycle />);
    act(() =>
      window.dispatchEvent(new InstallPromptEvent("beforeinstallprompt", { cancelable: true }))
    );
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByText("Keep your menu workspace close")).not.toBeInTheDocument();
    expect(Number(localStorage.getItem("menuminute:pwa-install-dismissed-at"))).toBeGreaterThan(0);
  });
});
