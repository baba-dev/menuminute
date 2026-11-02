// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  describeOrganizationAction,
  formatOperationDate,
  OperationsHistory,
} from "../src/app/(dashboard)/dashboard/organization/operations-history";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("organization operations history", () => {
  it("formats known commands and legacy audit actions for nontechnical users", () => {
    expect(describeOrganizationAction("outlet.roles")).toBe("Outlet permissions updated");
    expect(describeOrganizationAction("organization.rename")).toBe("Organization renamed");
    expect(describeOrganizationAction("member_invited")).toBe("Member invited");
    expect(describeOrganizationAction("")).toBe("Organization updated");
    expect(formatOperationDate("invalid-date")).toBe("Date unavailable");
  });

  it("shows five real entries per page and navigates through paginated responses", async () => {
    const mockFetch = vi.fn(async (input: string) => {
      const page = Number(new URL(input, "http://localhost").searchParams.get("page"));
      const firstId = (page - 1) * 5;
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: page === 1 ? 5 : 2 }, (_, index) => ({
            id: String(firstId + index),
            action: index === 0 ? "outlet.roles" : "brand.create",
            actorName: "Team member",
            createdAt: "2026-11-02T08:30:00.000Z",
          })),
          page,
          pageSize: 5,
          total: 7,
          totalPages: 2,
        }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<OperationsHistory organizationId="test-org" revision={1} />);

    expect((await screen.findAllByRole("row")).length).toBe(6); // heading + 5 rows
    expect(screen.getByText("Showing 1–5 of 7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous operations page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next operations page" }));
    await waitFor(() => expect(screen.getByText("Showing 6–7 of 7")).toBeInTheDocument());
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Next operations page" })).toBeDisabled();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/organizations/test-org/activity?page=2",
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("shows an empty state when no history is recorded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 1 }),
    })));

    render(<OperationsHistory organizationId="empty-org" revision={1} />);
    expect(await screen.findByText("No organization operations recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("Showing 0–0 of 0")).toBeInTheDocument();
  });
});
