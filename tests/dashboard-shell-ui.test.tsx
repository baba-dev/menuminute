// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DashboardNavigation } from "../src/modules/menu-product/dashboard-data";
import { WorkspaceNavigation } from "../src/app/(dashboard)/workspace-navigation";
import { WorkspaceBottomBar } from "../src/app/(dashboard)/workspace-bottom-bar";
import { CommandPalette } from "../src/app/(dashboard)/command-palette";
import { NotificationDrawer } from "../src/app/(dashboard)/notification-drawer";
import {
  ConnectionIndicator,
  NewMenu,
  NotificationBell,
  PaletteTrigger,
  TillChip,
} from "../src/app/(dashboard)/workspace-controls";
import { WorkspaceShellProvider } from "../src/app/(dashboard)/workspace-shell";
import { EMBER_ASK_EVENT } from "../src/lib/ember-events";
import { SOUND_PREFERENCE_KEY } from "../src/lib/sound-preference";

const push = vi.fn();
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, refresh: vi.fn() }),
}));
const chime = vi.fn();
vi.mock("../src/lib/sound-effects", () => ({
  playKitchenBell: (...args: unknown[]) => chime(...args),
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }));

const caps = (over: Partial<DashboardNavigation> = {}): DashboardNavigation => ({
  ordering: true,
  kitchen: true,
  ordersRead: true,
  kitchenRead: true,
  kitchenSetup: false,
  kitchenOperational: true,
  kitchenDraining: false,
  ...over,
});
const scope = {
  organizationId: "org1",
  outletId: "out1",
  outletName: "Test Kitchen",
  currency: "OMR",
  timezone: "Asia/Muscat",
};
const NOW = new Date().toISOString();
const pulse = (pending = 0, ready = 0) => ({
  state: "ready",
  data: { pending, preparing: 0, ready, active: pending + ready, completedToday: 0 },
});
function shellBody(over: Record<string, unknown> = {}) {
  return {
    outletId: "out1",
    checkedAt: NOW,
    pulse: pulse(),
    requests: { state: "ready", data: { open: 0, unacknowledged: 0, oldestAt: null } },
    till: { state: "restricted", data: null },
    ...over,
  };
}
const paletteBody = (over: Record<string, unknown> = {}) => ({
  outletId: "out1",
  dishes: {
    state: "ready",
    data: [
      { id: "d1", menuId: "m1", name: "Citrus salad", category: "Starters", soldOut: false },
      { id: "d2", menuId: "m1", name: "Lamb shawarma", category: "Mains", soldOut: true },
    ],
  },
  tables: {
    state: "ready",
    data: [{ id: "t4", tableNumber: "4", label: null, activeOrders: 1, unpaidOrders: 1 }],
  },
  orders: {
    state: "ready",
    data: [
      {
        id: "o42",
        orderNumber: 42,
        status: "pending",
        servicePoint: "Table 4",
        fulfillmentMode: "dine_in",
        paymentStatus: "unpaid",
      },
    ],
  },
  ...over,
});

type Routes = {
  shell?: () => unknown;
  palette?: () => unknown;
  availability?: () => Promise<{ ok: boolean; status: number }>;
};
function installFetch(routes: Routes = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (url.includes("/api/dashboard/shell")) return json(routes.shell?.() ?? shellBody());
    if (url.includes("/api/dashboard/palette")) return json(routes.palette?.() ?? paletteBody());
    if (url.includes("quick-availability") && init?.method === "POST")
      return routes.availability ? routes.availability() : { ok: true, status: 200 };
    throw new Error("unexpected fetch " + url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function Shell({
  children,
  capabilities = caps(),
  menuWrite = true,
  outletManage = true,
  assistantEnabled = false,
  withScope = true,
}: {
  children: React.ReactNode;
  capabilities?: DashboardNavigation | undefined;
  menuWrite?: boolean;
  outletManage?: boolean;
  assistantEnabled?: boolean;
  withScope?: boolean;
}) {
  return (
    <WorkspaceShellProvider
      scope={withScope ? scope : null}
      capabilities={capabilities}
      menuWrite={menuWrite}
      outletManage={outletManage}
      assistantEnabled={assistantEnabled}
    >
      {children}
    </WorkspaceShellProvider>
  );
}

beforeEach(() => {
  pathname = "/dashboard";
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("grouped sidebar", () => {
  it("groups destinations and keeps the original link names and current-page marker", () => {
    pathname = "/dashboard/pos/closing";
    render(<WorkspaceNavigation capabilities={caps()} />);
    const run = screen.getByRole("group", { name: "Run service" });
    expect(
      within(run)
        .getAllByRole("link")
        .map((l) => l.textContent)
    ).toEqual(["Orders", "Point of Sale", "Kitchen", "Dining floor"]);
    expect(
      within(screen.getByRole("group", { name: "Admin" })).getByRole("link", {
        name: "Organization & access",
      })
    ).toBeInTheDocument();
    expect(within(run).getByRole("link", { name: "Point of Sale" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("button", { name: /Add-ons/ })).toBeNull();
  });

  it("collapses unavailable items into Add-ons with an honest hint and a plans link", () => {
    render(
      <WorkspaceNavigation capabilities={caps({ ordering: false, kitchenOperational: false })} />
    );
    expect(screen.queryByRole("link", { name: "Orders" })).toBeNull();
    const toggle = screen.getByRole("button", { name: /Add-ons/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Upgrade to enable/)).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText(/Upgrade to enable/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "See plans" })[0]).toHaveAttribute(
      "href",
      "/pricing"
    );
  });

  it("says a missing role needs an administrator, not an upgrade", () => {
    render(<WorkspaceNavigation capabilities={caps({ ordersRead: false })} />);
    fireEvent.click(screen.getByRole("button", { name: /Add-ons/ }));
    expect(screen.getAllByText(/Ask an administrator/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "See plans" })).toBeNull();
  });

  it("never claims an upgrade is needed when availability could not be read", () => {
    render(<WorkspaceNavigation capabilities={undefined} />);
    expect(screen.queryByRole("button", { name: /Add-ons/ })).toBeNull();
    expect(screen.getAllByText("Availability unknown").length).toBeGreaterThan(0);
  });

  it("shows Platform admin only for server-authorized administrators", () => {
    const view = render(<WorkspaceNavigation capabilities={caps()} />);
    expect(screen.queryByRole("link", { name: "Platform admin" })).toBeNull();
    view.rerender(<WorkspaceNavigation capabilities={caps()} isSuperAdmin />);
    const admin = screen.getByRole("group", { name: "Admin" });
    expect(within(admin).getByRole("link", { name: "Platform admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });
});

describe("mobile bottom bar", () => {
  it("shows the destinations the user can use, with full accessible names, and More", async () => {
    installFetch();
    render(
      <Shell>
        <WorkspaceBottomBar />
      </Shell>
    );
    const bar = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(bar)
        .getAllByRole("link")
        .map((l) => l.getAttribute("aria-label"))
    ).toEqual(["Orders", "Point of Sale", "Kitchen", "Dining floor"]);
    expect(within(bar).getByRole("button", { name: "More" })).toBeInTheDocument();
  });

  it("keeps privileged navigation in More without showing it to other users", async () => {
    const view = render(
      <Shell withScope={false}>
        <WorkspaceBottomBar />
      </Shell>
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    let dialog = await screen.findByRole("dialog", { name: "More" });
    expect(within(dialog).queryByRole("link", { name: "Platform admin" })).toBeNull();
    view.unmount();

    render(
      <Shell withScope={false}>
        <WorkspaceBottomBar isSuperAdmin />
      </Shell>
    );
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    dialog = await screen.findByRole("dialog", { name: "More" });
    expect(within(dialog).getByRole("link", { name: "Platform admin" })).toHaveAttribute(
      "href",
      "/admin"
    );
  });

  it("keeps the Kitchen Setup name while it is still being set up", () => {
    render(
      <Shell
        capabilities={caps({ kitchenOperational: false, kitchenSetup: true })}
        withScope={false}
      >
        <WorkspaceBottomBar />
      </Shell>
    );
    expect(screen.getByRole("link", { name: "Kitchen Setup" })).toBeInTheDocument();
  });

  it("badges Orders with the number waiting, in the accessible name too", async () => {
    installFetch({ shell: () => shellBody({ pulse: pulse(3) }) });
    render(
      <Shell>
        <WorkspaceBottomBar />
      </Shell>
    );
    expect(await screen.findByRole("link", { name: "Orders, 3 waiting" })).toBeInTheDocument();
  });

  it("opens a More sheet with everything else and closes it on Escape", async () => {
    render(
      <Shell withScope={false}>
        <WorkspaceBottomBar />
      </Shell>
    );
    const more = screen.getByRole("button", { name: "More" });
    fireEvent.click(more);
    const sheet = await screen.findByRole("dialog", { name: "More" });
    for (const name of [
      "Menu Studio",
      "QR codes",
      "Reports & Insights",
      "Settings",
      "Account & security",
    ])
      expect(within(sheet).getByRole("link", { name })).toBeInTheDocument();
    // Items already on the bar are not repeated in the sheet.
    expect(within(sheet).queryByRole("link", { name: "Orders" })).toBeNull();
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More" })).toBeNull());
  });
});

describe("topbar controls", () => {
  it("shows an open till with expected cash, labelled as not counted", async () => {
    installFetch({
      shell: () =>
        shellBody({
          till: {
            state: "ready",
            data: {
              open: true,
              registers: 1,
              currency: "OMR",
              expectedMinor: "31000",
              openedAt: NOW,
            },
          },
        }),
    });
    render(
      <Shell>
        <TillChip />
      </Shell>
    );
    const chip = await screen.findByRole("link", { name: /Till open/ });
    expect(chip.textContent).toMatch(/Till open · .*31/);
    expect(chip.textContent).toMatch(/expected cash, not counted/);
    expect(chip).toHaveAttribute("href", "/dashboard/pos/closing");
  });

  it("shows a closed till, and nothing at all without till access or when unreadable", async () => {
    installFetch({
      shell: () =>
        shellBody({
          till: {
            state: "ready",
            data: {
              open: false,
              registers: 0,
              currency: "OMR",
              expectedMinor: null,
              openedAt: null,
            },
          },
        }),
    });
    const { unmount } = render(
      <Shell>
        <TillChip />
      </Shell>
    );
    expect(await screen.findByRole("link", { name: /Till closed/ })).toBeInTheDocument();
    unmount();
    for (const state of ["restricted", "unavailable"]) {
      installFetch({ shell: () => shellBody({ till: { state, data: null } }) });
      const view = render(
        <Shell>
          <TillChip />
        </Shell>
      );
      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
      await act(async () => undefined);
      expect(view.container.querySelector(".mm-topbar-chip")).toBeNull();
      view.unmount();
    }
  });

  it("offers + New only for what the user may create", async () => {
    const open = async (props: { menuWrite: boolean; outletManage: boolean }) => {
      const view = render(
        <Shell {...props} withScope={false}>
          <NewMenu />
        </Shell>
      );
      const trigger = screen.getByRole("button", { name: /New/ });
      trigger.focus();
      fireEvent.keyDown(trigger, { key: "Enter" });
      return view;
    };
    const full = await open({ menuWrite: true, outletManage: true });
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
      "New order",
      "Add a dish",
      "Import a menu",
      "Create a QR code",
      "Add a table or service point",
    ]);
    full.unmount();
    cleanup();
    await open({ menuWrite: false, outletManage: false });
    expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
      "New order",
    ]);
  });

  it("names the connection state in words and in the accessible label", async () => {
    installFetch();
    render(
      <Shell>
        <ConnectionIndicator />
      </Shell>
    );
    expect(await screen.findByRole("button", { name: /Live.*Last synced/ })).toBeInTheDocument();
  });

  it("describes what the bell is counting", async () => {
    installFetch({
      shell: () =>
        shellBody({
          pulse: pulse(2),
          requests: { state: "ready", data: { open: 1, unacknowledged: 1, oldestAt: NOW } },
        }),
    });
    render(
      <Shell>
        <NotificationBell />
      </Shell>
    );
    expect(
      await screen.findByRole("button", { name: "Notifications, 3 items need attention" })
    ).toBeInTheDocument();
  });
});

describe("command palette", () => {
  function palette(props: Partial<React.ComponentProps<typeof Shell>> = {}) {
    return render(
      <Shell {...props}>
        <PaletteTrigger />
        <CommandPalette />
      </Shell>
    );
  }
  const open = async () => {
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    return screen.findByRole("combobox", { name: "Search or run a command" });
  };

  it("opens with Ctrl+K, toggles closed with it, and is reachable from the visible trigger", async () => {
    installFetch();
    palette();
    const input = await open();
    expect(input).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull()
    );
    fireEvent.click(screen.getByRole("button", { name: /Search pages/ }));
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("filters as you type and moves with the arrow keys and Enter", async () => {
    installFetch();
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "settings" } });
    const option = await screen.findByRole("option", { name: /Settings/ });
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("finds an order by number and opens it in Orders", async () => {
    installFetch();
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "#42" } });
    const option = await screen.findByRole("option", { name: /Order #42/ });
    fireEvent.click(option);
    expect(push).toHaveBeenCalledWith("/dashboard/orders?q=42");
  });

  it("finds a table and opens it on the floor with that table highlighted", async () => {
    installFetch();
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "table 4" } });
    // The order seated at Table 4 also matches, which is useful; pick the table itself.
    fireEvent.click(await screen.findByRole("option", { name: /^Table 4/ }));
    expect(push).toHaveBeenCalledWith("/dashboard/floor?table=t4");
  });

  it("marks a dish sold out: stays open, shows Saving, then confirms", async () => {
    let release: (value: { ok: boolean; status: number }) => void = () => undefined;
    const fetchMock = installFetch({
      availability: () => new Promise((resolve) => (release = resolve)),
    });
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "citrus" } });
    fireEvent.click(await screen.findByRole("option", { name: /Mark Citrus salad sold out/ }));
    // Pending: it names neither the old nor the new action, and cannot be toggled again.
    const saving = await screen.findByRole("option", { name: /Saving Citrus salad/ });
    expect(saving).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("option", { name: /Mark Citrus salad sold out/ })).toBeNull();
    const post = fetchMock.mock.calls.find((call) => call[1]?.method === "POST")!;
    expect(String(post[0])).toContain(
      "/api/organizations/org1/outlets/out1/menu/quick-availability"
    );
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      menuId: "m1",
      dishId: "d1",
      soldOut: true,
    });
    await act(async () => release({ ok: true, status: 200 }));
    expect(await screen.findByRole("option", { name: /Restore Citrus salad/ })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("rolls a failed change back and offers Retry inside the palette", async () => {
    installFetch({ availability: async () => ({ ok: false, status: 500 }) });
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "citrus" } });
    fireEvent.click(await screen.findByRole("option", { name: /Mark Citrus salad sold out/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/back to its previous status/);
    expect(within(alert).getByRole("button", { name: /Retry/ })).toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: /Mark Citrus salad sold out/ })
    ).toBeInTheDocument();
    expect(toastError).toHaveBeenCalled();
  });

  it("does not offer Retry for a role that is not allowed to change availability", async () => {
    installFetch({ availability: async () => ({ ok: false, status: 403 }) });
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "citrus" } });
    fireEvent.click(await screen.findByRole("option", { name: /Mark Citrus salad sold out/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/role cannot change/);
    expect(within(alert).queryByRole("button", { name: /Retry/ })).toBeNull();
  });

  it("hides sources the user cannot read and says plainly when one is down", async () => {
    installFetch({
      palette: () =>
        paletteBody({
          orders: { state: "restricted", data: null },
          tables: { state: "unavailable", data: null },
        }),
    });
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "42" } });
    await screen.findByRole("option", { name: /Search orders for #42/ });
    expect(screen.queryByRole("option", { name: /^Order #42/ })).toBeNull();
    expect(screen.getByText(/Search for tables is unavailable/)).toBeInTheDocument();
  });

  it("hands a question to Ember without sending it", async () => {
    installFetch();
    const asked = vi.fn();
    window.addEventListener(EMBER_ASK_EVENT, (event) => asked((event as CustomEvent).detail));
    palette({ assistantEnabled: true });
    const input = await open();
    fireEvent.change(input, { target: { value: "how many orders are waiting" } });
    fireEvent.click(await screen.findByRole("option", { name: /Ask Ember/ }));
    expect(asked).toHaveBeenCalledWith({ prompt: "how many orders are waiting" });
    // No assistant request was made by the palette itself.
    const urls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(urls.some((url) => url.includes("/api/assistant"))).toBe(false);
  });

  it("offers nothing dynamic when the index could not be fetched", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/api/dashboard/palette")) throw new Error("down");
      return { ok: true, status: 200, json: async () => shellBody() };
    });
    vi.stubGlobal("fetch", fetchMock);
    palette();
    const input = await open();
    fireEvent.change(input, { target: { value: "settings" } });
    expect(await screen.findByRole("option", { name: /Settings/ })).toBeInTheDocument();
    expect(
      await screen.findByText(/Search for dishes, orders, tables is unavailable/)
    ).toBeInTheDocument();
  });
});

describe("notification drawer and the single sound setting", () => {
  function drawer(props: Partial<React.ComponentProps<typeof Shell>> = {}) {
    return render(
      <Shell {...props}>
        <NotificationBell />
        <NotificationDrawer />
      </Shell>
    );
  }

  it("aggregates alerts with a word and an icon for severity, and links to where to act", async () => {
    installFetch({
      shell: () =>
        shellBody({
          pulse: pulse(2, 1),
          requests: {
            state: "ready",
            data: {
              open: 1,
              unacknowledged: 1,
              oldestAt: new Date(Date.now() - 20 * 60_000).toISOString(),
            },
          },
        }),
    });
    drawer();
    fireEvent.click(await screen.findByRole("button", { name: /Notifications, 3 items/ }));
    const dialog = await screen.findByRole("dialog", { name: "Notifications" });
    expect(within(dialog).getByText("Urgent")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Needs attention").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("For your information")).toBeInTheDocument();
    const link = within(dialog).getByRole("link", { name: /2 orders await acceptance/ });
    expect(link).toHaveAttribute("href", "/dashboard/orders");
  });

  it("is plainly all-clear only when sources were readable and quiet", async () => {
    installFetch();
    drawer();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(await screen.findByText(/All clear/)).toBeInTheDocument();
  });

  it("never reads an unavailable source as all-clear", async () => {
    installFetch({ shell: () => shellBody({ pulse: { state: "unavailable", data: null } }) });
    drawer();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(
      await screen.findByText(/Order activity is temporarily unavailable/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/All clear/)).toBeNull();
  });

  it("has one sound switch that is off by default, persists, and previews the chime", async () => {
    installFetch();
    drawer();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    const toggle = await screen.findByRole("switch", { name: /Chime for new orders/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
    expect(JSON.parse(window.localStorage.getItem(SOUND_PREFERENCE_KEY)!)).toEqual({
      enabled: true,
      mutedUntil: null,
    });
    expect(chime).toHaveBeenCalledWith("orders");
  });

  it("can mute for an hour and unmute", async () => {
    window.localStorage.setItem(
      SOUND_PREFERENCE_KEY,
      JSON.stringify({ enabled: true, mutedUntil: null })
    );
    installFetch();
    drawer();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Mute for 1 hour/ }));
    expect(await screen.findByText(/Muted until/)).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(SOUND_PREFERENCE_KEY)!).mutedUntil
    ).toBeGreaterThan(Date.now());
    fireEvent.click(screen.getByRole("button", { name: "Unmute" }));
    await waitFor(() => expect(screen.queryByText(/Muted until/)).toBeNull());
  });

  it("carries forward an old per-page sound switch the first time it is read", async () => {
    window.localStorage.setItem("menuminute.orders.sound", "enabled");
    installFetch();
    drawer();
    fireEvent.click(screen.getByRole("button", { name: /Notifications/ }));
    expect(await screen.findByRole("switch", { name: /Chime for new orders/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(window.localStorage.getItem("menuminute.orders.sound")).toBeNull();
  });
});

describe("shell polling and the chime", () => {
  async function arrive(path: string) {
    pathname = path;
    let pending = 0;
    installFetch({ shell: () => shellBody({ pulse: pulse(pending) }) });
    render(
      <Shell>
        <NotificationBell />
      </Shell>
    );
    await screen.findByRole("button", { name: /Notifications/ });
    await act(async () => undefined);
    pending = 2;
    // A refresh is triggered by the tab regaining focus.
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
  }

  it("announces newly arrived orders to everyone and chimes on pages without their own audio", async () => {
    await arrive("/dashboard/menu");
    await waitFor(() =>
      expect(screen.getByTestId("shell-announcer")).toHaveTextContent(
        "2 new orders are awaiting acceptance."
      )
    );
    expect(chime).toHaveBeenCalledWith("orders");
  });

  it("stays silent on pages that already chime for their own events, but still announces", async () => {
    await arrive("/dashboard/orders");
    await waitFor(() =>
      expect(screen.getByTestId("shell-announcer")).toHaveTextContent("2 new orders")
    );
    expect(chime).not.toHaveBeenCalled();
  });

  it("does not chime for orders that were already waiting when the page loaded", async () => {
    pathname = "/dashboard/menu";
    installFetch({ shell: () => shellBody({ pulse: pulse(5) }) });
    render(
      <Shell>
        <NotificationBell />
      </Shell>
    );
    await screen.findByRole("button", { name: /5 items need attention/ });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(chime).not.toHaveBeenCalled();
    expect(screen.getByTestId("shell-announcer")).toHaveTextContent("");
  });

  it("treats a malformed response as a failed refresh, not as data", async () => {
    installFetch({ shell: () => ({ outletId: "someone-else" }) });
    render(
      <Shell>
        <ConnectionIndicator />
      </Shell>
    );
    expect(await screen.findByRole("button", { name: /Reconnecting/ })).toBeInTheDocument();
  });
});

describe("focus returns to whatever opened a sheet", () => {
  it("returns to the palette trigger on Escape", async () => {
    installFetch();
    render(
      <Shell>
        <PaletteTrigger />
        <CommandPalette />
      </Shell>
    );
    const trigger = screen.getByRole("button", { name: /Search pages/ });
    trigger.focus();
    fireEvent.click(trigger);
    const input = await screen.findByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Command palette" })).toBeNull()
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("returns to the bell after the notification drawer closes", async () => {
    installFetch();
    render(
      <Shell>
        <NotificationBell />
        <NotificationDrawer />
      </Shell>
    );
    const bell = screen.getByRole("button", { name: /Notifications/ });
    bell.focus();
    fireEvent.click(bell);
    const dialog = await screen.findByRole("dialog", { name: "Notifications" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Notifications" })).toBeNull());
    await waitFor(() => expect(bell).toHaveFocus());
  });

  it("returns to the More button after the More sheet closes", async () => {
    render(
      <Shell withScope={false}>
        <WorkspaceBottomBar />
      </Shell>
    );
    const more = screen.getByRole("button", { name: "More" });
    more.focus();
    fireEvent.click(more);
    const sheet = await screen.findByRole("dialog", { name: "More" });
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "More" })).toBeNull());
    await waitFor(() => expect(more).toHaveFocus());
  });

  it("opened by the shortcut, it hands focus back to where the person was", async () => {
    installFetch();
    render(
      <Shell>
        <button type="button">Somewhere on the page</button>
        <CommandPalette />
      </Shell>
    );
    const somewhere = screen.getByRole("button", { name: "Somewhere on the page" });
    somewhere.focus();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(somewhere).toHaveFocus());
  });
});
