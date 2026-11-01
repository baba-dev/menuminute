// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScopeNav } from "../src/components/settings/settings-scope-nav";

let pathname = "/account";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("settings information architecture", () => {
  beforeEach(() => {
    pathname = "/account";
  });

  it("exposes exactly one destination for each ownership scope", () => {
    render(<SettingsScopeNav />);

    expect(screen.getByRole("navigation", { name: "Settings areas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /My account/ })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: /Outlet settings/ })).toHaveAttribute(
      "href",
      "/dashboard/settings"
    );
    expect(screen.getByRole("link", { name: /Organization/ })).toHaveAttribute(
      "href",
      "/dashboard/organization"
    );
    expect(screen.getAllByRole("link")).toHaveLength(3);
  });

  it("marks the current scope without changing the destinations", () => {
    pathname = "/dashboard/settings";
    render(<SettingsScopeNav />);

    expect(screen.getByRole("link", { name: /Outlet settings/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /My account/ })).not.toHaveAttribute("aria-current");
  });

  it("keeps security inside the personal account scope", () => {
    pathname = "/account/security";
    render(<SettingsScopeNav />);

    expect(screen.getByRole("link", { name: /My account/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });
});
