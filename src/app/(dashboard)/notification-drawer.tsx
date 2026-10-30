"use client";

import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import {
  CheckCircle2,
  Info,
  OctagonAlert,
  RefreshCw,
  TriangleAlert,
  Volume2,
  VolumeX,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ageLabel, formatMinor, type AlertSeverity } from "@/modules/dashboard/notification-model";
import { playKitchenBell } from "@/lib/sound-effects";
import { useReturnFocus } from "@/lib/use-return-focus";
import { useSoundPreference } from "@/lib/use-sound-preference";
import { useWorkspaceShell } from "./workspace-shell";

const severityMeta: Record<AlertSeverity, { label: string; Icon: typeof Info }> = {
  critical: { label: "Urgent", Icon: OctagonAlert },
  warning: { label: "Needs attention", Icon: TriangleAlert },
  info: { label: "For your information", Icon: Info },
};

const clock = (timestamp: number, timezone: string) => {
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

/**
 * One place for everything that needs a person, plus the single sound setting that replaces
 * the separate Orders, Kitchen and POS switches.
 */
export function NotificationDrawer() {
  const {
    drawerOpen,
    setDrawerOpen,
    alerts,
    snapshot,
    connection,
    lastSyncAt,
    scope,
    now,
    refresh,
  } = useWorkspaceShell();
  const { preference, setEnabled, snooze, clearSnooze } = useSoundPreference();
  const returnFocus = useReturnFocus();
  const snoozed =
    preference.enabled && preference.mutedUntil !== null && preference.mutedUntil > now;
  const timezone = scope?.timezone ?? "UTC";
  const till = snapshot?.till.state === "ready" ? snapshot.till.data : null;

  return (
    <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="mm-sheet-overlay" />
        <Dialog.Content
          className="mm-sheet mm-sheet--side"
          aria-describedby="mm-notify-description"
          onOpenAutoFocus={returnFocus.onOpenAutoFocus}
          onCloseAutoFocus={returnFocus.onCloseAutoFocus}
        >
          <header className="mm-sheet-header">
            <div>
              <Dialog.Title className="mm-sheet-title">Notifications</Dialog.Title>
              <Dialog.Description id="mm-notify-description" className="mm-sheet-description">
                {scope ? scope.outletName + " · " : ""}Everything that needs attention, in one
                place.
              </Dialog.Description>
            </div>
            <Dialog.Close className="mm-icon-button" aria-label="Close notifications">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </header>

          <section className="mm-notify-section" aria-labelledby="mm-notify-status">
            <h3 id="mm-notify-status" className="mm-notify-heading">
              Status
            </h3>
            <div className="mm-notify-row" data-state={connection}>
              {connection === "offline" ? (
                <WifiOff size={18} aria-hidden="true" />
              ) : connection === "reconnecting" ? (
                <RefreshCw size={18} aria-hidden="true" />
              ) : (
                <Wifi size={18} aria-hidden="true" />
              )}
              <div>
                <strong>
                  {connection === "live"
                    ? "Live"
                    : connection === "offline"
                      ? "Offline"
                      : "Reconnecting"}
                </strong>
                <small>
                  {lastSyncAt ? "Last synced " + clock(lastSyncAt, timezone) : "Not synced yet"}
                </small>
              </div>
              <button type="button" className="mm-icon-button" onClick={() => void refresh()}>
                <RefreshCw size={15} aria-hidden="true" /> Refresh
              </button>
            </div>
            {till && (
              <Link
                href={till.open ? "/dashboard/pos/closing" : "/dashboard/pos"}
                className="mm-notify-row mm-notify-link"
                onClick={() => setDrawerOpen(false)}
              >
                <Wallet size={18} aria-hidden="true" />
                <div>
                  <strong>
                    {till.open
                      ? till.registers > 1
                        ? till.registers + " tills open"
                        : "Till open"
                      : "Till closed"}
                  </strong>
                  <small>
                    {till.open
                      ? (till.expectedMinor
                          ? "Expected cash " +
                            formatMinor(till.expectedMinor, till.currency) +
                            ", not counted"
                          : "Expected cash unavailable") +
                        (till.openedAt ? " · opened " + ageLabel(till.openedAt, now) : "")
                      : "Open it from Point of Sale to take payments."}
                  </small>
                </div>
              </Link>
            )}
          </section>

          <section className="mm-notify-section" aria-labelledby="mm-notify-alerts">
            <h3 id="mm-notify-alerts" className="mm-notify-heading">
              Alerts
            </h3>
            {alerts.length > 0 ? (
              <ul className="mm-notify-list">
                {alerts.map((alert) => {
                  const { label, Icon } = severityMeta[alert.severity];
                  const body = (
                    <>
                      <Icon size={18} aria-hidden="true" />
                      <div>
                        <span className="mm-notify-severity" data-severity={alert.severity}>
                          {label}
                        </span>
                        <strong>{alert.title}</strong>
                        <small>{alert.detail}</small>
                      </div>
                    </>
                  );
                  return (
                    <li key={alert.id}>
                      {alert.href ? (
                        <Link
                          href={alert.href}
                          className="mm-notify-row mm-notify-link"
                          data-severity={alert.severity}
                          onClick={() => setDrawerOpen(false)}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="mm-notify-row" data-severity={alert.severity}>
                          {body}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : snapshot ? (
              <p className="mm-notify-empty">
                <CheckCircle2 size={18} aria-hidden="true" /> All clear. Nothing needs attention
                right now.
              </p>
            ) : (
              <p className="mm-notify-empty" role="status">
                Checking for alerts…
              </p>
            )}
          </section>

          <section className="mm-notify-section" aria-labelledby="mm-notify-sound">
            <h3 id="mm-notify-sound" className="mm-notify-heading">
              Sound
            </h3>
            <div className="mm-notify-row">
              {preference.enabled ? (
                <Volume2 size={18} aria-hidden="true" />
              ) : (
                <VolumeX size={18} aria-hidden="true" />
              )}
              <div>
                <label htmlFor="mm-sound-switch">
                  <strong>Chime for new orders and guest requests</strong>
                </label>
                <small>
                  One setting for Orders, Kitchen, Point of Sale and every other page. Off by
                  default; browsers need a tap before they allow sound.
                </small>
              </div>
              <Switch.Root
                id="mm-sound-switch"
                className="mm-switch"
                checked={preference.enabled}
                onCheckedChange={(checked) => {
                  setEnabled(checked);
                  if (checked) {
                    try {
                      playKitchenBell("orders");
                    } catch {
                      /* audio permission */
                    }
                  }
                }}
              >
                <Switch.Thumb className="mm-switch-thumb" />
              </Switch.Root>
            </div>
            {preference.enabled && (
              <div className="mm-notify-actions">
                {snoozed ? (
                  <>
                    <span role="status">Muted until {clock(preference.mutedUntil!, timezone)}</span>
                    <button type="button" className="mm-icon-button" onClick={clearSnooze}>
                      Unmute
                    </button>
                  </>
                ) : (
                  <button type="button" className="mm-icon-button" onClick={() => snooze(60)}>
                    <VolumeX size={15} aria-hidden="true" /> Mute for 1 hour
                  </button>
                )}
              </div>
            )}
          </section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
