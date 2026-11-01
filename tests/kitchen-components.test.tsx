// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { DishDetails } from "../src/app/kitchen/dish-details";
import { KitchenExpeditor } from "../src/app/kitchen/kitchen-expeditor";
import { KitchenBoard } from "../src/app/kitchen/kitchen-board";
import { useWakeLock } from "../src/app/kitchen/use-wake-lock";
import type {
  KitchenExpoOrder,
  KitchenSnapshot,
  KitchenWorkView,
} from "../src/modules/kitchen/service";

vi.mock("next/navigation", () => ({
  usePathname: () => "/kitchen",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("../src/lib/sound-effects", () => ({
  playKitchenBell: vi.fn(),
  playWoodenTap: vi.fn(),
  isAudioSuspended: () => false,
  unlockAudio: async () => true,
}));
vi.mock("../src/components/menu-product/theme-control", () => ({ ThemeControl: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("DishDetails", () => {
  it("shows declared allergens, customisations and the guest note", () => {
    render(
      <DishDetails
        variantName="Full"
        selectedOptions={[{ groupName: "Spice", optionName: "Extra hot" }]}
        notes="Less oil, no onion"
        dishSafety={{
          declared: true,
          allergens: ["dairy", "nuts"],
          crossContact: "Shared tandoor",
          verified: false,
        }}
      />
    );
    const allergens = screen.getByRole("group", { name: "Allergen information" });
    expect(within(allergens).getByText("Dairy")).toBeTruthy();
    expect(within(allergens).getByText("Tree nuts")).toBeTruthy();
    expect(within(allergens).getByText(/Cross-contact: Shared tandoor/)).toBeTruthy();
    expect(within(allergens).getByText(/not verified/)).toBeTruthy();
    expect(screen.getByText("Extra hot")).toBeTruthy();
    expect(screen.getByText("Less oil, no onion")).toBeTruthy();
  });
  it("never claims a dish is allergen free and omits 'not verified' when verified", () => {
    const { rerender } = render(
      <DishDetails variantName={null} selectedOptions={[]} notes={null} dishSafety={null} />
    );
    expect(screen.queryByRole("group", { name: "Allergen information" })).toBeNull();
    expect(screen.queryByText(/free/i)).toBeNull();
    rerender(
      <DishDetails
        variantName={null}
        selectedOptions={[]}
        notes={null}
        dishSafety={{ declared: true, allergens: ["soy"], verified: true }}
      />
    );
    expect(screen.getByText("Soy")).toBeTruthy();
    expect(screen.queryByText(/not verified/)).toBeNull();
  });
});

const order = (over: Partial<KitchenExpoOrder> = {}): KitchenExpoOrder => ({
  id: "o1",
  orderNumber: 1042,
  status: "preparing",
  version: 3,
  fulfillmentMode: "dine_in",
  tableLabel: "7",
  orderNotes: null,
  total: 2,
  done: 1,
  released: 0,
  started: 1,
  createdAt: new Date().toISOString(),
  items: [
    {
      workId: "w1",
      version: 2,
      stationId: "grill",
      stationName: "Grill",
      dishName: "Paneer Tikka",
      quantity: 2,
      variantName: null,
      selectedOptions: [{ groupName: "Spice", optionName: "Mild" }],
      notes: "no onion",
      dishSafety: { allergens: ["dairy"], verified: false },
      status: "complete",
      releasedAt: null,
    },
    {
      workId: "w2",
      version: 1,
      stationId: "tandoor",
      stationName: "Tandoor",
      dishName: "Naan",
      quantity: 3,
      variantName: null,
      selectedOptions: [],
      notes: null,
      status: "preparing",
      releasedAt: null,
    },
  ],
  ...over,
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("KitchenExpeditor (Final Check & Order Release)", () => {
  it("releases one finished dish without waiting for the others", async () => {
    const calls: Array<{ url: string; body?: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          calls.push({ url, body: JSON.parse(String(init.body)) });
          return json({ released: true });
        }
        return json({ cursor: 1, overflow: false, orders: [order()] });
      })
    );
    render(<KitchenExpeditor base="/k" enabled cursor={1} work={[]} stations={[]} />);
    expect(await screen.findByText(/no onion/)).toBeTruthy();
    expect(screen.getByText("Dairy")).toBeTruthy();
    expect(screen.queryByText("Waiting for remaining stations")).toBeNull();
    // Only the finished dish offers a release button; the cooking dish does not.
    expect(screen.queryByRole("button", { name: /Release Naan/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Release Paneer Tikka for order 1042" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.url).toBe("/k/release-item");
    expect(calls[0]!.body).toMatchObject({ workId: "w1", expectedVersion: 2 });
  });
  it("uses a two-step check before releasing several dishes at once", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "POST") {
          calls.push(url);
          return json({});
        }
        return json({ cursor: 1, overflow: false, orders: [order()] });
      })
    );
    render(<KitchenExpeditor base="/k" enabled cursor={1} work={[]} stations={[]} />);
    const first = await screen.findByRole("button", { name: /Final check, then release 1 ready/ });
    fireEvent.click(first);
    expect(calls).toHaveLength(0); // first click only arms the check
    fireEvent.click(await screen.findByRole("button", { name: /Checked — release 1 now/ }));
    await waitFor(() => expect(calls).toEqual(["/k/release-item"]));
  });
  it("keeps the last known orders on a transient failure and warns", async () => {
    let fail = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        fail
          ? json({ message: "boom" }, 500)
          : json({ cursor: 1, overflow: false, orders: [order()] })
      )
    );
    render(<KitchenExpeditor base="/k" enabled cursor={1} work={[]} stations={[]} />);
    await screen.findByText(/Paneer Tikka/);
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/Paneer Tikka/)).toBeTruthy(); // not blanked
    expect(screen.getByRole("alert").textContent).toMatch(/last known orders/);
  });
  it("clears the list only when access is revoked", async () => {
    let status = 200;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        status === 200
          ? json({ cursor: 1, overflow: false, orders: [order()] })
          : json({ message: "no" }, status)
      )
    );
    render(<KitchenExpeditor base="/k" enabled cursor={1} work={[]} stations={[]} />);
    await screen.findByText(/Paneer Tikka/);
    status = 403;
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(screen.queryByText(/Paneer Tikka/)).toBeNull());
  });
  it("is a level-2 section with level-3 order cards (no heading skips)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ cursor: 1, overflow: false, orders: [order()] }))
    );
    render(<KitchenExpeditor base="/k" enabled cursor={1} work={[]} stations={[]} />);
    await screen.findByText(/Paneer Tikka/);
    expect(screen.getByRole("heading", { level: 2, name: /Final Check/ })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "#1042" })).toBeTruthy();
  });
});

type Listener = (event: MessageEvent) => void;
class FakeEventSource {
  static last: FakeEventSource | null = null;
  listeners = new Map<string, Listener[]>();
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, listener: Listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, data: unknown) {
    for (const l of this.listeners.get(type) ?? [])
      l({ data: JSON.stringify(data) } as MessageEvent);
  }
  close() {}
}
const work = (over: Partial<KitchenWorkView> = {}): KitchenWorkView => ({
  id: "w1",
  stationId: "grill",
  orderId: "o1",
  orderNumber: 1042,
  fulfillmentMode: "dine_in",
  tableLabel: "7",
  brandLabel: "Kitchen",
  dishName: "Paneer Tikka",
  quantity: 2,
  variantName: null,
  selectedOptions: [],
  notes: null,
  orderNotes: null,
  status: "queued",
  version: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...over,
});
const snapshot = (works: KitchenWorkView[], cursor: number): KitchenSnapshot => ({
  cursor,
  enabled: true,
  stations: [{ id: "grill", name: "Grill", active: true, position: 0 }],
  routes: [],
  members: [],
  work: works,
  workOverflow: false,
});

describe("KitchenBoard accessibility and cues", () => {
  beforeEach(() => {
    FakeEventSource.last = null;
    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).endsWith("/expo")
          ? json({ cursor: 0, overflow: false, orders: [] })
          : json(snapshot([], 0))
      )
    );
  });
  it("starts with the hero heading and keeps heading levels in order", () => {
    render(
      <KitchenBoard
        organizationId="org"
        outletId="out"
        outletName="Spice Route"
        initial={snapshot([work()], 1)}
        canManage
        menuDishes={[]}
        timezone="Asia/Kolkata"
      />
    );
    const levels = screen.getAllByRole("heading").map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    // No heading may skip a level relative to the previous one.
    levels.forEach((level, i) => {
      if (i > 0) expect(level - levels[i - 1]!).toBeLessThanOrEqual(1);
    });
    expect(screen.getByText("Spice Route").tagName).toBe("P");
  });
  it("announces a new ticket to screen readers and in the tab title", async () => {
    render(
      <KitchenBoard
        organizationId="org"
        outletId="out"
        outletName="Spice Route"
        initial={snapshot([work()], 1)}
        canManage
        menuDishes={[]}
      />
    );
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull());
    act(() => {
      FakeEventSource.last!.emit(
        "snapshot",
        snapshot([work(), work({ id: "w2", orderNumber: 1043, dishName: "Garlic Naan" })], 2)
      );
    });
    const live = await screen.findByText("New ticket: 2 Garlic Naan, order 1043");
    expect(live.getAttribute("class")).toContain("sr-only");
    expect(live.parentElement?.getAttribute("aria-live") ?? live.getAttribute("aria-live")).toBe(
      "polite"
    );
    await waitFor(() => expect(document.title.startsWith("(2)")).toBe(true));
  });
  it("warns when the server has been silent too long", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <KitchenBoard
        organizationId="org"
        outletId="out"
        outletName="Spice Route"
        initial={snapshot([work()], 1)}
        canManage
        menuDishes={[]}
      />
    );
    await waitFor(() => expect(FakeEventSource.last).not.toBeNull());
    act(() => {
      FakeEventSource.last!.emit("heartbeat", {});
    });
    // Block the 15s reconciliation poll so only the heartbeat age matters.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {}))
    );
    await act(async () => {
      vi.advanceTimersByTime(70_000);
    });
    expect(await screen.findByText(/Nothing heard from the kitchen server/)).toBeTruthy();
    vi.useRealTimers();
  });
});

function WakeProbe({ active }: { active: boolean }) {
  const { supported, held } = useWakeLock(active);
  return (
    <p>
      {supported ? "supported" : "unsupported"}:{held ? "held" : "not-held"}
    </p>
  );
}
describe("useWakeLock", () => {
  it("holds the screen lock, re-acquires it on return and releases on unmount", async () => {
    const release = vi.fn(async () => {});
    const request = vi.fn(async () => ({ release }));
    vi.stubGlobal("navigator", { ...navigator, wakeLock: { request } });
    const { unmount } = render(<WakeProbe active />);
    expect(await screen.findByText("supported:held")).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
    // The browser drops the lock when the tab is hidden; coming back must re-request it.
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(await screen.findByText("supported:not-held")).toBeTruthy();
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    unmount();
    expect(release).toHaveBeenCalled();
  });
  it("degrades silently when unsupported or refused", async () => {
    const { unmount } = render(<WakeProbe active />);
    expect(await screen.findByText("unsupported:not-held")).toBeTruthy();
    unmount();
    vi.stubGlobal("navigator", {
      ...navigator,
      wakeLock: {
        request: async () => {
          throw new Error("denied");
        },
      },
    });
    render(<WakeProbe active />);
    expect(await screen.findByText("supported:not-held")).toBeTruthy();
  });
});
