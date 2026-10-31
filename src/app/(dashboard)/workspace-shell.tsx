"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import type { DashboardNavigation } from "@/modules/menu-product/dashboard-data";
import {
  arrivals,
  attentionCount,
  connectionState,
  deriveAlerts,
  type AlertItem,
  type ClientShellSnapshot,
  type ConnectionState,
} from "@/modules/dashboard/notification-model";
import { parseShellSnapshot } from "@/modules/dashboard/shell-client";
import { pageHasOwnAudio } from "@/lib/sound-preference";
import { playKitchenBell } from "@/lib/sound-effects";

const REFRESH_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

export type ShellScope = {
  organizationId: string;
  outletId: string;
  outletName: string;
  currency: string;
  timezone: string;
};

export type ShellContextValue = {
  scope: ShellScope | null;
  capabilities: DashboardNavigation | undefined;
  menuWrite: boolean;
  outletManage: boolean;
  assistantEnabled: boolean;
  snapshot: ClientShellSnapshot | null;
  connection: ConnectionState;
  lastSyncAt: number | null;
  now: number;
  alerts: AlertItem[];
  attention: number;
  modKey: string;
  refresh: () => Promise<void>;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useWorkspaceShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useWorkspaceShell must be used inside WorkspaceShellProvider");
  return value;
}

/**
 * Owns everything the shell shares: one poll for the till chip, notifications and connection
 * state; the global Ctrl/Cmd+K shortcut; and the open state of the palette, notification
 * drawer and mobile More sheet. Polling pauses while the tab is hidden.
 */
export function WorkspaceShellProvider({
  scope,
  capabilities,
  menuWrite,
  outletManage,
  assistantEnabled,
  children,
}: {
  scope: ShellScope | null;
  capabilities: DashboardNavigation | undefined;
  menuWrite: boolean;
  outletManage: boolean;
  assistantEnabled: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [snapshot, setSnapshot] = useState<ClientShellSnapshot | null>(null);
  const snapshotRef = useRef<ClientShellSnapshot | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [lastFailureAt, setLastFailureAt] = useState<number | null>(null);
  const [online, setOnline] = useState(true);
  const [now, setNow] = useState(0);
  const [modKey, setModKey] = useState("Ctrl");
  const [announcement, setAnnouncement] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const outletId = scope?.outletId ?? null;

  const previousPathname = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
    // Only an actual page change dismisses open sheets, never the first render.
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    const close = window.setTimeout(() => {
      setMoreOpen(false);
      setPaletteOpen(false);
    }, 0);
    return () => window.clearTimeout(close);
  }, [pathname]);

  const refresh = useCallback(async () => {
    if (!outletId || running.current || document.visibilityState !== "visible") return;
    if (!navigator.onLine) return;
    running.current = true;
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/dashboard/shell", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("refresh failed");
      const next = parseShellSnapshot(await response.json(), outletId);
      if (!next) throw new Error("invalid response");
      const found = arrivals(snapshotRef.current, next);
      snapshotRef.current = next;
      setSnapshot(next);
      setLastSuccessAt(Date.now());
      if (found.orders + found.requests > 0) {
        const parts: string[] = [];
        if (found.orders)
          parts.push(
            found.orders === 1
              ? "1 new order is awaiting acceptance"
              : found.orders + " new orders are awaiting acceptance"
          );
        if (found.requests)
          parts.push(
            found.requests === 1
              ? "1 new guest request is waiting"
              : found.requests + " new guest requests are waiting"
          );
        setAnnouncement(parts.join(". ") + ".");
        // Pages that already chime for their own events stay in charge of their own audio.
        if (!pageHasOwnAudio(pathnameRef.current)) {
          try {
            playKitchenBell("orders");
          } catch {
            /* audio is optional */
          }
        }
      }
    } catch {
      if (!abort.signal.aborted || document.visibilityState === "visible")
        setLastFailureAt(Date.now());
    } finally {
      window.clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
      running.current = false;
    }
  }, [outletId]);

  useEffect(() => {
    if (!outletId) return;
    const first = window.setTimeout(() => void refresh(), 0);
    const resume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const interval = window.setInterval(resume, REFRESH_MS);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      controller.current?.abort();
    };
  }, [outletId, refresh]);

  useEffect(() => {
    const start = window.setTimeout(() => {
      setNow(Date.now());
      setOnline(navigator.onLine);
      setModKey(/Mac|iPhone|iPad/i.test(navigator.userAgent) ? "⌘" : "Ctrl");
    }, 0);
    const tick = window.setInterval(() => setNow(Date.now()), 15_000);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(tick);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || event.shiftKey) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const connection = connectionState({ online, lastSuccessAt, lastFailureAt, now });
  const alerts = useMemo(
    () => (snapshot || connection !== "live" ? deriveAlerts(snapshot, connection, now) : []),
    [snapshot, connection, now]
  );
  const attention = attentionCount(snapshot, connection);

  const value = useMemo<ShellContextValue>(
    () => ({
      scope,
      capabilities,
      menuWrite,
      outletManage,
      assistantEnabled,
      snapshot,
      connection,
      lastSyncAt: lastSuccessAt,
      now,
      alerts,
      attention,
      modKey,
      refresh,
      paletteOpen,
      setPaletteOpen,
      drawerOpen,
      setDrawerOpen,
      moreOpen,
      setMoreOpen,
    }),
    [
      scope,
      capabilities,
      menuWrite,
      outletManage,
      assistantEnabled,
      snapshot,
      connection,
      lastSuccessAt,
      now,
      alerts,
      attention,
      modKey,
      refresh,
      paletteOpen,
      drawerOpen,
      moreOpen,
    ]
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
      <p className="sr-only" role="status" aria-live="polite" data-testid="shell-announcer">
        {announcement}
      </p>
    </ShellContext.Provider>
  );
}
