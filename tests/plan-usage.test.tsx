// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { PlanMeterStrip, PlanUsagePanel } from "../src/components/plans/plan-usage";
import { PLAN_LIMITS } from "../src/modules/plans/catalog";
import { buildPlanUsageView } from "../src/modules/plans/view";

afterEach(cleanup);

const free = (dishes: number, qrCodes: number, orders?: { used: number; cap: number }) =>
  buildPlanUsageView({
    plan: "free",
    limits: PLAN_LIMITS.free,
    counts: { dishes, qrCodes, tables: 0, chairs: 0 },
    intake: orders ? { enabled: true, ...orders } : null,
  })!;

describe("PlanMeterStrip", () => {
  it("renders nothing without usage data or without a matching meter", () => {
    const { container, rerender } = render(<PlanMeterStrip view={null} only={["dishes"]} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<PlanMeterStrip view={free(1, 1)} only={["orders"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes an accessible meter and states the limit in words, not colour alone", () => {
    render(<PlanMeterStrip view={free(20, 1)} only={["dishes"]} />);
    const meter = screen.getByRole("meter", { name: "Dishes" });
    expect(meter).toHaveAttribute("aria-valuenow", "20");
    expect(meter).toHaveAttribute("aria-valuemax", "20");
    expect(meter).toHaveAttribute("aria-valuetext", "20 of 20 dishes used");
    expect(screen.getByText("Limit reached")).toBeInTheDocument();
    expect(screen.getByText("Ordering allows 200")).toBeInTheDocument();
    // At the cap the link names the plan to look at.
    expect(screen.getByRole("link", { name: /See Ordering/ })).toHaveAttribute("href", "/billing");
  });

  it("stays quiet with a neutral link while usage is comfortable", () => {
    render(<PlanMeterStrip view={free(3, 1)} only={["dishes"]} />);
    expect(screen.getByText("17 left")).toBeInTheDocument();
    expect(screen.queryByText(/Ordering allows/)).toBeNull();
    expect(screen.getByRole("link", { name: /Plans & usage/ })).toBeInTheDocument();
  });

  it("clamps the assistive value for existing over-cap data but reports the truth in text", () => {
    render(<PlanMeterStrip view={free(27, 1)} only={["dishes"]} />);
    expect(screen.getByRole("meter", { name: "Dishes" })).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByText("7 over the limit")).toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
  });
});

describe("PlanUsagePanel", () => {
  it("lists every meter and what each feature needs, with text status for each row", () => {
    render(<PlanUsagePanel view={free(17, 2, { used: 8, cap: 100 })} outletName="Saffron" />);
    const panel = screen.getByRole("region", { name: /Free plan/ });
    expect(within(panel).getAllByRole("meter")).toHaveLength(5);
    const rows = within(panel).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("Included")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Unlock with Ordering")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Unlock with Kitchen Pro")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Compare plans/ })).toHaveAttribute(
      "href",
      "/billing"
    );
  });

  it("offers no upsell link on the top plan", () => {
    const pro = buildPlanUsageView({
      plan: "kitchen_pro",
      limits: PLAN_LIMITS.kitchen_pro,
      counts: { dishes: 5, qrCodes: 2, tables: 0, chairs: 0 },
      intake: null,
    })!;
    render(<PlanUsagePanel view={pro} />);
    expect(screen.queryByRole("link", { name: /Compare plans/ })).toBeNull();
    expect(screen.getAllByText("Included")).toHaveLength(3);
  });
});
