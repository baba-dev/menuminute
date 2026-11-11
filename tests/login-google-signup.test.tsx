// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TERMS_VERSION } from "../src/content/legal";

const { social } = vi.hoisted(() => ({
  social: vi.fn(async (_input: unknown) => ({ error: null })),
}));
vi.mock("@/lib/auth-client", () => ({
  authClient: { signIn: { social, email: vi.fn() } },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("next=%2Fdashboard%2Forders"),
}));

import { LoginForm } from "../src/app/login/login-form";

beforeEach(() => {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  social.mockClear();
});

describe("login Google button", () => {
  it("registers unknown Google accounts with the disclosed current terms, then routes via /login", async () => {
    render(<LoginForm googleEnabled />);
    expect(screen.getAllByRole("link", { name: "Terms of Service" })[0]).toHaveAttribute(
      "href",
      "/terms"
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await waitFor(() => expect(social).toHaveBeenCalledTimes(1));
    expect(social).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "google",
        requestSignUp: true,
        callbackURL: "/login?next=%2Fdashboard%2Forders",
        additionalData: { acceptTerms: true, termsVersion: TERMS_VERSION },
      })
    );
  });

  it("hides the Google path when the provider is not configured", () => {
    render(<LoginForm googleEnabled={false} />);
    expect(screen.queryByRole("button", { name: /Continue with Google/ })).toBeNull();
  });
});
