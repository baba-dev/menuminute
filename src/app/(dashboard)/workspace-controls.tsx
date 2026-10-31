"use client";

import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Plus, Search, Wallet, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { formatMinor, ageLabel } from "@/modules/dashboard/notification-model";
import { navState, navItems } from "@/modules/dashboard/nav-model";
import { useWorkspaceShell } from "./workspace-shell";

/** Opens the command palette. The shortcut hint adapts to the platform after mount. */
export function PaletteTrigger() {
  const { setPaletteOpen, modKey } = useWorkspaceShell();
  return (
    <button
      type="button"
      className="mm-topbar-search"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={() => setPaletteOpen(true)}
    >
      <Search size={16} aria-hidden="true" />
      <span className="mm-topbar-search-label">Search or run a command</span>
      <kbd className="mm-topbar-kbd" aria-hidden="true">
        {modKey} K
      </kbd>
      <span className="sr-only">
        Search pages, dishes, orders and tables, or run a command. Shortcut: {modKey} then K.
      </span>
    </button>
  );
}

type NewItem = { id: string; label: string; href: string };

/** "+ New": only the creations this user can actually perform. */
export function NewMenu() {
  const { capabilities, menuWrite, outletManage } = useWorkspaceShell();
  const posAvailable =
    navState(
      navItems.find((item) => item.id === "pos")!,
      capabilities
    ).state === "available";
  const items: NewItem[] = [];
  if (posAvailable) items.push({ id: "order", label: "New order", href: "/dashboard/pos" });
  if (menuWrite) {
    items.push(
      { id: "dish", label: "Add a dish", href: "/dashboard/menu" },
      { id: "import", label: "Import a menu", href: "/dashboard/menu/import" },
      { id: "qr", label: "Create a QR code", href: "/dashboard/qr-codes" }
    );
  }
  if (outletManage)
    items.push({ id: "table", label: "Add a table or service point", href: "/dashboard/settings" });
  if (!items.length) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" className="mm-topbar-new">
          <Plus size={16} aria-hidden="true" />
          <span className="mm-topbar-new-label">New</span>
          <span className="sr-only"> (create something)</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mm-menu" align="end" sideOffset={8}>
          {items.map((item) => (
            <DropdownMenu.Item key={item.id} asChild>
              <Link href={item.href} className="mm-menu-item">
                {item.label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/**
 * Shift state. Shows "expected" cash because that is what the ledger can know; it is not a
 * drawer count. Hidden entirely for people without till access or when it cannot be read.
 */
export function TillChip() {
  const { snapshot, scope } = useWorkspaceShell();
  if (!snapshot || snapshot.till.state !== "ready" || !scope) return null;
  const till = snapshot.till.data;
  if (!till.open) {
    return (
      <Link href="/dashboard/pos" className="mm-topbar-chip" data-state="closed">
        <Wallet size={15} aria-hidden="true" />
        <span>Till closed</span>
      </Link>
    );
  }
  const expected = till.expectedMinor ? formatMinor(till.expectedMinor, till.currency) : null;
  return (
    <Link
      href="/dashboard/pos/closing"
      className="mm-topbar-chip"
      data-state="open"
      title="Expected cash from the till ledger. This is not a counted amount."
    >
      <Wallet size={15} aria-hidden="true" />
      <span>
        Till open
        {expected ? " · " + expected : ""}
      </span>
      <span className="sr-only"> expected cash, not counted</span>
    </Link>
  );
}

const timeFormat = (timestamp: number, timezone: string) => {
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(timestamp);
  } catch {
    return new Date(timestamp).toISOString().slice(11, 16) + " UTC";
  }
};

/** Connection and last-sync. The state is carried by an icon and a word, not colour alone. */
export function ConnectionIndicator() {
  const { connection, lastSyncAt, scope, refresh, now } = useWorkspaceShell();
  if (!scope) return null;
  const synced = lastSyncAt
    ? "Last synced " +
      timeFormat(lastSyncAt, scope.timezone) +
      " (" +
      ageLabel(new Date(lastSyncAt).toISOString(), now) +
      ")"
    : "Not synced yet";
  const text =
    connection === "live" ? "Live" : connection === "offline" ? "Offline" : "Reconnecting";
  const Icon = connection === "live" ? Wifi : connection === "offline" ? WifiOff : RefreshCw;
  return (
    <button
      type="button"
      className="mm-topbar-connection"
      data-state={connection}
      onClick={() => void refresh()}
      title={synced + ". Select to refresh."}
    >
      <span className="mm-connection-dot" aria-hidden="true">
        <Icon size={12} />
      </span>
      <span className="mm-topbar-connection-label">{text}</span>
      <span className="sr-only">. {synced}. Select to refresh.</span>
    </button>
  );
}

export function NotificationBell() {
  const { attention, setDrawerOpen, drawerOpen } = useWorkspaceShell();
  return (
    <button
      type="button"
      className="mm-topbar-bell"
      aria-haspopup="dialog"
      aria-expanded={drawerOpen}
      onClick={() => setDrawerOpen(true)}
      aria-label={
        attention > 0
          ? "Notifications, " +
            attention +
            (attention === 1 ? " item needs" : " items need") +
            " attention"
          : "Notifications, nothing needs attention"
      }
    >
      <Bell size={18} aria-hidden="true" />
      {attention > 0 && (
        <span className="mm-topbar-bell-badge" aria-hidden="true">
          {attention > 99 ? "99+" : attention}
        </span>
      )}
    </button>
  );
}
