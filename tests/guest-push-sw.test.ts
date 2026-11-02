import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

type Handler = (event: unknown) => void;
// Obviously synthetic, zero-entropy capability so secret scanners have nothing to flag.
const CAP = "t".repeat(20);
const LINK = `/m/spice-route/orders/ord-123?trackingToken=${CAP}`;

async function loadWorker(
  stored: unknown,
  windows: { visibilityState: string; url: string }[] = []
) {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const handlers = new Map<string, Handler>();
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const navigated: string[] = [];
  const worker: Record<string, unknown> = {
    location: { origin: "https://food.bababuilds.com" },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) =>
        void shown.push({ title, options }),
    },
    clients: {
      matchAll: async () =>
        windows.map((w) => ({
          ...w,
          focus: async () => undefined,
          navigate: async (href: string) => void navigated.push(href),
        })),
      openWindow: async (href: string) => void opened.push(href),
    },
  };
  const caches = {
    open: async () => ({
      match: async () => (stored === undefined ? undefined : { json: async () => stored }),
    }),
  };
  vm.runInNewContext(source, {
    Headers,
    Object,
    Promise,
    Set,
    URL,
    Date,
    Number,
    self: worker,
    caches,
  });
  const run = async (type: string, event: Record<string, unknown>) => {
    let pending: Promise<unknown> = Promise.resolve();
    handlers.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => (pending = p) });
    await pending;
  };
  const policy = worker["__MENUMINUTE_PWA_TEST__"] as {
    isGuestOrderLink: (v: unknown) => boolean;
    readGuestPushLink: (now?: number) => Promise<string | null>;
  };
  return { run, shown, opened, navigated, policy };
}

describe("guest order push in the service worker", () => {
  it("accepts only a strict same-origin order link", async () => {
    const { policy } = await loadWorker(undefined);
    expect(policy.isGuestOrderLink(LINK)).toBe(true);
    for (const bad of [
      `https://evil.example/m/a/orders/b?trackingToken=${CAP}`,
      `//evil.example/m/a/orders/b?trackingToken=${CAP}`,
      "/dashboard/orders",
      "/m/a/orders/b",
      "/m/a/orders/b?trackingToken=short",
      `/m/a/orders/b?trackingToken=${CAP}&x=1`,
      `/m/a/orders/../../admin?trackingToken=${CAP}`,
      LINK + "x".repeat(600),
      null,
      42,
    ])
      expect(policy.isGuestOrderLink(bad)).toBe(false);
  });

  it("shows a generic order notification with the stored link and no payload content", async () => {
    const { run, shown } = await loadWorker({ url: LINK, savedAt: Date.now() });
    await run("push", {});
    expect(shown).toHaveLength(1);
    expect(shown[0]!.title).toBe("Update on your order");
    expect(shown[0]!.options["data"]).toEqual({ url: LINK });
    expect(shown[0]!.options["tag"]).toBe("menuminute-order");
  });

  it("falls back to the staff notification when there is no fresh valid guest link", async () => {
    for (const stored of [
      undefined,
      { url: LINK, savedAt: Date.now() - 13 * 60 * 60 * 1000 },
      { url: "https://evil.example/x", savedAt: Date.now() },
      { url: LINK, savedAt: Date.now() + 60 * 60 * 1000 },
    ]) {
      const { run, shown } = await loadWorker(stored);
      await run("push", {});
      expect(shown[0]!.title).toBe("MenuMinute • new activity");
      expect(shown[0]!.options["data"]).toEqual({ url: "/dashboard/orders" });
    }
  });

  it("does not notify while the diner is already looking at the app", async () => {
    const { run, shown } = await loadWorker({ url: LINK, savedAt: Date.now() }, [
      { visibilityState: "visible", url: "https://food.bababuilds.com/m/x" },
    ]);
    await run("push", {});
    expect(shown).toHaveLength(0);
  });

  it("opens the validated order link on click and never an attacker-supplied URL", async () => {
    const good = await loadWorker(undefined);
    await good.run("notificationclick", { notification: { close() {}, data: { url: LINK } } });
    expect(good.opened).toEqual(["https://food.bababuilds.com" + LINK]);

    const bad = await loadWorker(undefined);
    await bad.run("notificationclick", {
      notification: { close() {}, data: { url: "https://evil.example/phish" } },
    });
    expect(bad.opened).toEqual(["https://food.bababuilds.com/dashboard/orders"]);
  });
});
