// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaymentsConsole } from "./payments/payments-console";
import { OrgsConsole } from "./organizations/orgs-console";
import { AdminAppearanceControl } from "./admin-appearance-control";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin",
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("admin appearance and privileged workflows", () => {
  it("offers the explicit System preference", () => {
    render(<AdminAppearanceControl />);
    const select = screen.getByRole("combobox", {name: "Appearance preference"});
    expect(screen.getByRole("option", {name: "System"})).toBeTruthy();
    fireEvent.change(select, {target: {value: "dark"}});
    expect(document.documentElement.dataset.theme).toBe("dark");
    fireEvent.change(select, {target: {value: "system"}});
    expect(localStorage.getItem("menuminute.appearance")).toBeNull();
  });

  it("saves a plan without transmitting the prohibited pricing field", async () => {
    const onUpdatePlan = vi.fn(async () => ({}));
    const noop = vi.fn(async () => ({ok: true as const}));
    render(
      <PaymentsConsole
        plans={[{id: "tier-1", name: "standard", displayName: "Standard", monthlyPricePaise: 59900, features: null, isActive: true, sortOrder: 0}]}
        subscriptions={[]}
        grants={[]}
        grantsTotal={0}
        financials={{byCurrency: [], planSubscriptions: []}}
        onUpdatePlan={onUpdatePlan}
        onIssueGrant={noop}
        onRevokeGrant={noop}
        onRenewGrant={noop}
        onSearchTargets={async () => ({ok: true, targets: []})}
        onListGrants={async () => ({ok: true, grants: [], total: 0, page: 1})}
      />
    );
    fireEvent.click(screen.getByRole("button", {name: "Subscription Plans Catalog"}));
    fireEvent.click(screen.getByRole("button", {name: "Edit Plan Settings"}));
    expect(screen.queryByLabelText("Monthly Price (Minor Units / Paise)")).toBeNull();
    fireEvent.click(screen.getByRole("button", {name: "Save Changes"}));
    await waitFor(() => {
      expect(onUpdatePlan).toHaveBeenCalledWith("tier-1", {displayName: "Standard", isActive: true, sortOrder: 0});
    });
  });

  it("reactivates a tenant with a fresh, explicit audit reason", async () => {
    const onSetActive = vi.fn(async () => ({}));
    const org = {id: "org-1", name: "Test Restaurant", isActive: false, mfaRequired: false, version: 3, createdAt: "2026-10-29", outletCount: 0, memberCount: 0};
    render(
      <OrgsConsole
        organizations={[org]}
        total={1} page={1} totalPages={1} search=""
        onFetchDetails={async () => ({organization: org, members: [], outlets: [], brands: [], entitlements: []})}
        onSetActive={onSetActive}
        onSetMfaRequired={async () => ({})}
      />
    );
    fireEvent.click(screen.getByRole("button", {name: "Inspect"}));
    const reactivation = await screen.findByRole("button", {name: "Reactivate Organization"});
    fireEvent.click(reactivation);
    await waitFor(() => {
      expect(onSetActive).toHaveBeenCalledWith("org-1", true, "Operator reactivation");
    });
  });
});
