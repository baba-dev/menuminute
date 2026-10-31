// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountSignOutButton } from "../src/app/account/sign-out-button";

const { signOut, replace, refresh } = vi.hoisted(() => ({
  signOut: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("../src/lib/auth-client", () => ({ authClient: { signOut } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("account sign out", () => {
  it("signs out and returns the user to login", async () => {
    signOut.mockResolvedValue({ error: null });
    render(<AccountSignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("reports a failed sign out and enables retry", async () => {
    signOut.mockResolvedValue({ error: { message: "request failed" } });
    render(<AccountSignOutButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't sign out");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
