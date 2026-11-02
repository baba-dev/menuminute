// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PlanBento } from "../src/components/plans/plan-bento";
import { buildBentoView } from "../src/modules/plans/bento";

afterEach(cleanup);
const now = new Date("2026-11-10T10:00:00Z");
const inDays = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString();
const view = (
  lifecycle: Parameters<typeof buildBentoView>[0]["lifecycle"],
  plan: "free" | "ordering"
) =>
  buildBentoView({
    plan,
    usage: null,
    intake: null,
    canManageBilling: true,
    billingEnabled: true,
    lifecycle,
    now,
  })!;

describe("PlanBento lifecycle states", () => {
  it("shows the trial chip and flips the next tile to 'keep after your trial'", () => {
    render(
      <PlanBento
        view={view(
          { trial: { startedAt: inDays(-5), endsAt: inDays(9) }, dunning: null },
          "ordering"
        )}
      />
    );
    expect(screen.getByText("Trial · 9 days left")).toBeInTheDocument();
    expect(screen.getByText("Keep after your trial")).toBeInTheDocument();
    expect(screen.getByText(/return to the Free limits/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Subscribe to keep Ordering/ })).toHaveAttribute(
      "href",
      "/billing?plan=ordering"
    );
  });

  it("announces a failed renewal as a status with a way to the billing page", () => {
    render(
      <PlanBento
        view={view(
          { trial: null, dunning: { status: "pending", graceUntil: inDays(4) } },
          "ordering"
        )}
      />
    );
    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("We could not renew your plan");
    expect(alert).toHaveTextContent("Your access continues until 14 Nov 2026");
    expect(screen.getByRole("link", { name: /View billing/ })).toHaveAttribute("href", "/billing");
  });

  it("uses an alert role once the subscription has stopped", () => {
    render(
      <PlanBento
        view={view({ trial: null, dunning: { status: "halted", graceUntil: null } }, "free")}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Your subscription has stopped");
  });

  it("renders no banner or chip when nothing is happening", () => {
    render(<PlanBento view={view({ trial: null, dunning: null }, "free")} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/Trial/)).toBeNull();
  });
});
