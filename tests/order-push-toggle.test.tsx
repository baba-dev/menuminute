// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderPushToggle } from "../src/components/menu-product/order-push-toggle";

const TOKEN = "spice-route";
const ORDER = "ord-123";
const CAPABILITY = "t".repeat(20);
// Synthetic zero-entropy stand-in: 65 bytes encoded as base64url (87 characters).
const PUBLIC_VAPID_STUB = "A".repeat(87);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/" + "e".repeat(40);

type Calls = { url: string; init?: RequestInit }[];

function setup(
  options: { enabled?: boolean; permission?: NotificationPermission; subscribed?: boolean } = {}
) {
  const calls: Calls = [];
  const stored = new Map<string, string>();
  const subscription = { endpoint: ENDPOINT, unsubscribe: vi.fn(async () => true) };
  let active = Boolean(options.subscribed);
  const pushManager = {
    getSubscription: vi.fn(async () => (active ? subscription : null)),
    subscribe: vi.fn(async () => {
      active = true;
      return subscription;
    }),
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  const notification = {
    permission: options.permission ?? "default",
    requestPermission: vi.fn(async () => options.permission ?? "granted"),
  };
  Object.defineProperty(window, "Notification", { configurable: true, value: notification });
  Object.defineProperty(window, "caches", {
    configurable: true,
    value: {
      open: async () => ({
        put: async (key: string, response: Response) => void stored.set(key, await response.text()),
        delete: async (key: string) => stored.delete(key),
      }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (!init?.method || init.method === "GET")
        return Response.json({
          enabled: options.enabled ?? true,
          publicKey: PUBLIC_VAPID_STUB,
          subscribed: options.subscribed ?? false,
        });
      return Response.json({ subscribed: init.method === "POST" });
    })
  );
  return { calls, stored, pushManager, subscription, notification };
}

describe("order push toggle", () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("renders nothing when the outlet rollout is off or the order is finished", async () => {
    setup({ enabled: false });
    const { container, rerender } = render(
      <OrderPushToggle token={TOKEN} orderId={ORDER} capability={CAPABILITY} finished={false} />
    );
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    setup({ enabled: true });
    rerender(<OrderPushToggle token={TOKEN} orderId={ORDER} capability={CAPABILITY} finished />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks nothing until tapped, then subscribes, saves the order link and can turn off", async () => {
    const t = setup();
    render(
      <OrderPushToggle token={TOKEN} orderId={ORDER} capability={CAPABILITY} finished={false} />
    );
    const button = await screen.findByRole("button", { name: /Notify me about this order/ });
    expect(t.notification.requestPermission).not.toHaveBeenCalled();
    expect(t.pushManager.subscribe).not.toHaveBeenCalled();

    fireEvent.click(button);
    await screen.findByText(/We'll alert you when this order changes/);
    expect(t.pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true })
    );
    const post = t.calls.find((c) => c.init?.method === "POST")!;
    expect(JSON.parse(String(post.init!.body))).toEqual({
      token: TOKEN,
      trackingToken: CAPABILITY,
      endpoint: ENDPOINT,
    });
    expect(JSON.parse(t.stored.get("/__guest-push-link")!).url).toBe(
      `/m/${TOKEN}/orders/${ORDER}?trackingToken=${CAPABILITY}`
    );

    fireEvent.click(screen.getByRole("button", { name: /Turn off/ }));
    await screen.findByRole("button", { name: /Notify me about this order/ });
    expect(t.calls.some((c) => c.init?.method === "DELETE")).toBe(true);
    expect(t.stored.has("/__guest-push-link")).toBe(false);
  });

  it("explains blocked permission and never subscribes", async () => {
    const t = setup({ permission: "denied" });
    render(
      <OrderPushToggle token={TOKEN} orderId={ORDER} capability={CAPABILITY} finished={false} />
    );
    expect(await screen.findByText(/blocked in your browser settings/)).toBeInTheDocument();
    expect(t.pushManager.subscribe).not.toHaveBeenCalled();
  });

  it("refuses an order link that could not be validated by the service worker", async () => {
    const t = setup();
    render(<OrderPushToggle token={TOKEN} orderId={ORDER} capability="short" finished={false} />);
    fireEvent.click(await screen.findByRole("button", { name: /Notify me about this order/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available for this order/);
    expect(t.pushManager.subscribe).not.toHaveBeenCalled();
  });
});
