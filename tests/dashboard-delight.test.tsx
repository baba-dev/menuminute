// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MilestoneTicket } from "../src/components/dashboard/milestone-ticket";
import { orderMilestones } from "../src/modules/dashboard/milestones";
import { LoadingRegion, Skeleton, SkeletonCard } from "../src/components/ui/skeleton";
import { RouteFocus, WorkspaceSkipLink } from "../src/app/(dashboard)/workspace-a11y";
import {
  DashboardLayoutEditor,
  layoutStyles,
} from "../src/app/(dashboard)/dashboard/dashboard-layout-editor";
import { defaultDashboardLayout, dashboardWidgetIds } from "../src/modules/dashboard/layout";

const refresh = vi.fn();
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  usePathname: () => pathname,
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  pathname = "/dashboard";
});

describe("skip link and route focus", () => {
  it("is a real link to the main landmark", () => {
    render(<WorkspaceSkipLink />);
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#workspace-main"
    );
  });

  it("moves focus to the new page heading after client navigation, not on first render", () => {
    const { rerender } = render(
      <>
        <RouteFocus />
        <main id="workspace-main">
          <h1>Overview</h1>
        </main>
      </>
    );
    expect(document.body).toHaveFocus();
    pathname = "/dashboard/orders";
    rerender(
      <>
        <RouteFocus />
        <main id="workspace-main">
          <h1>Orders</h1>
        </main>
      </>
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toHaveFocus();
  });
});

describe("route focus follows a heading that is replaced while the page loads", () => {
  const page = (heading: string) => (
    <>
      <RouteFocus />
      <main id="workspace-main">
        <h1>{heading}</h1>
      </main>
    </>
  );

  it("moves to the real heading when a loading heading is swapped out", async () => {
    const { rerender } = render(page("Overview"));
    pathname = "/dashboard/settings";
    rerender(page("Preparing your settings…"));
    expect(screen.getByRole("heading", { name: "Preparing your settings…" })).toHaveFocus();
    // Suspense replaces the loading element with the real page.
    rerender(
      <>
        <RouteFocus />
        <main id="workspace-main">
          <section>
            <h1>Outlet settings</h1>
          </section>
        </main>
      </>
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Outlet settings" })).toHaveFocus()
    );
  });

  it("does not steal focus back once the person has moved it", async () => {
    const { rerender } = render(page("Overview"));
    pathname = "/dashboard/orders";
    rerender(
      <>
        <RouteFocus />
        <main id="workspace-main">
          <h1>Loading orders…</h1>
          <input aria-label="Search" />
        </main>
      </>
    );
    const input = screen.getByLabelText("Search");
    input.focus();
    rerender(
      <>
        <RouteFocus />
        <main id="workspace-main">
          <h1>Orders</h1>
          <input aria-label="Search" />
        </main>
      </>
    );
    await act(async () => undefined);
    expect(screen.getByLabelText("Search")).toHaveFocus();
  });
});

describe("skeletons", () => {
  it("announces once and hides the placeholders from assistive technology", () => {
    render(
      <LoadingRegion label="Loading reports…">
        <Skeleton height={12} />
        <SkeletonCard lines={2} />
      </LoadingRegion>
    );
    const region = screen.getByRole("status", { name: "Loading reports…" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(2);
  });
});

describe("milestone ticket", () => {
  beforeEach(() => vi.useFakeTimers());

  it("is a polite status that never takes focus and can be dismissed", () => {
    const onDismiss = vi.fn();
    render(<MilestoneTicket milestone={orderMilestones[0]!} onDismiss={onDismiss} />);
    const ticket = screen.getByTestId("milestone-ticket");
    expect(ticket).toHaveAttribute("role", "status");
    expect(ticket).toHaveAttribute("aria-live", "polite");
    expect(document.body).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: /Dismiss: First order out the door/ }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses itself after a while but pauses while hovered", () => {
    const onDismiss = vi.fn();
    render(<MilestoneTicket milestone={orderMilestones[1]!} onDismiss={onDismiss} />);
    const ticket = screen.getByTestId("milestone-ticket");
    fireEvent.mouseEnter(ticket);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(ticket);
    act(() => void vi.advanceTimersByTime(15_001));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("layout editor", () => {
  const widgets = [...dashboardWidgetIds];

  function mockFetch(ok: boolean) {
    const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500 });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("generates CSS only from the closed widget enum, with order, hidden and pinned", () => {
    const css = layoutStyles({
      ...defaultDashboardLayout,
      hidden: ["floor"],
      pinned: ["health"],
    });
    expect(css).toContain('.mm-widget[data-widget="health"]{order:0}');
    expect(css).toContain('.mm-widget[data-widget="floor"]{display:none}');
    expect(css).toContain('content:"Pinned"');
    expect(css).not.toMatch(/[<>]/);
  });

  it("opens, is operable by keyboard-reachable buttons, and returns focus on Escape", () => {
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    const trigger = screen.getByRole("button", { name: /Customize layout/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = screen.getByRole("region", { name: "Customize your overview" });
    expect(within(panel).getAllByRole("listitem")).toHaveLength(widgets.length);
    // Edges are disabled rather than silently doing nothing.
    expect(within(panel).getByRole("button", { name: "Move At a glance up" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Move Guest service down" })).toBeDisabled();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Customize your overview" })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("applies a change instantly, announces it, then saves and refreshes the server render", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(true);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Customize layout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move At a glance down" }));
    expect(screen.getByText("At a glance is now position 2 of 6.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled(); // debounced
    await act(async () => void vi.advanceTimersByTime(450));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/account/dashboard-layout");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body).order[1]).toBe("kpis");
    expect(refresh).toHaveBeenCalled();
    expect(screen.getByText("Saved to your account")).toBeInTheDocument();
  });

  it("coalesces rapid changes into one save", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(true);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Customize layout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Dining floor" }));
    fireEvent.click(screen.getByRole("button", { name: "Pin Outlet health" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Today’s priorities down" }));
    await act(async () => void vi.advanceTimersByTime(450));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.hidden).toEqual(["floor"]);
    expect(body.pinned).toEqual(["health"]);
  });

  it("saves immediately on Done instead of waiting for the debounce", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(true);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Customize layout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Dining floor" }));
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("region", { name: "Customize your overview" })).toBeNull();
  });

  it("does not lose a change when the page is hidden before the debounce fires", () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch(true);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Customize layout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Pin Outlet health" }));
    expect(fetchMock).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1];
    expect(init.keepalive).toBe(true);
    expect(JSON.parse(init.body).pinned).toEqual(["health"]);
  });

  it("sends nothing on page hide when there is nothing unsaved", () => {
    const fetchMock = mockFetch(true);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    window.dispatchEvent(new Event("pagehide"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rolls back to the last saved layout and says so when saving fails", async () => {
    vi.useFakeTimers();
    mockFetch(false);
    render(
      <DashboardLayoutEditor initialLayout={defaultDashboardLayout} presentWidgets={widgets} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Customize layout/ }));
    fireEvent.click(screen.getByRole("button", { name: "Hide Dining floor" }));
    expect(screen.getByRole("button", { name: "Show Dining floor" })).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(toastError).toHaveBeenCalled();
    expect(toastError.mock.calls[0]![0]).toBe("Couldn’t save your layout");
    expect(toastError.mock.calls[0]![1].action.label).toBe("Retry");
    expect(screen.getByRole("button", { name: "Hide Dining floor" })).toBeInTheDocument();
    expect(screen.getByText(/Your previous layout is restored/)).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("dish availability optimistic state", () => {
  it("never names the final state while the change is still pending", async () => {
    const { DishAvailabilityDialog } =
      await import("../src/app/(dashboard)/dashboard/dish-availability-dialog");
    let release: (value: unknown) => void = () => undefined;
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return new Promise((resolve) => (release = resolve));
      return Promise.resolve({
        ok: true,
        json: async () => ({
          canWrite: true,
          revision: 3,
          overrides: [],
          publishedDocument: { categories: [{ items: [{ id: "d", soldOut: false }] }] },
        }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <DishAvailabilityDialog
        outletId="o1"
        outletName="Test"
        canManage
        items={[
          {
            id: "d",
            menuId: "m",
            menuName: "Live menu",
            name: "Citrus salad",
            category: "Signature",
            imageSrc: "/x.png",
            soldOut: false,
            hasOtherRestrictions: false,
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Dish Availability" }));
    fireEvent.click(await screen.findByRole("button", { name: /Mark sold out Citrus salad/ }));
    // Pending: the control reports saving and offers neither the old nor the new action.
    expect(await screen.findByRole("button", { name: /Saving Citrus salad/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Restore Citrus salad/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark sold out Citrus salad/ })).toBeNull();
    release({ ok: true });
    expect(await screen.findByRole("button", { name: /Restore Citrus salad/ })).toBeInTheDocument();
  });
});
