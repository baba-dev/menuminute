"use client";

import { useCallback, useEffect, useState } from "react";
import { Laptop2, Smartphone, ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

type Device = {
  id: string;
  browser: string;
  platform: string;
  current: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
};
export function DevicePanel() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | "others" | "current" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/security/devices", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to retrieve devices. Try again.");
      const data: { devices: Device[] } = await response.json();
      setDevices(data.devices);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to retrieve devices.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function revoke(target: string | "others" | "current") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (target === "current") {
        const result = await authClient.signOut();
        if (result.error) throw new Error("Couldn't sign out this device. Please retry.");
        router.replace("/login");
        router.refresh();
        return;
      }
      const response = await fetch("/api/security/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(
          target === "others"
            ? { action: "revoke-others" }
            : { action: "revoke", sessionId: target }
        ),
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "That session is no longer active. Refresh your devices."
            : "Couldn't confirm revocation. Refresh before trying again."
        );
      const result: { revoked: number } = await response.json();
      await load();
      setNotice(
        result.revoked === 0
          ? "No other sessions were active."
          : String(result.revoked) +
              " session" +
              (result.revoked === 1 ? "" : "s") +
              " revoked. Their next authenticated request will be denied."
      );
      setConfirm(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to revoke session.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mm-device-panel" aria-labelledby="mm-device-title">
      <div className="mm-device-heading">
        <div>
          <span className="mm-device-eyebrow">ACCOUNT / ACCESS</span>
          <h2 id="mm-device-title">Where you're signed in.</h2>
          <p>
            Review sessions associated with your account. You can end other sessions without
            interrupting this one.
          </p>
        </div>
        <ShieldCheck size={28} aria-hidden="true" />
      </div>
      <div className="mm-device-toolbar">
        <button type="button" disabled={busy || loading} onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
        <button
          type="button"
          disabled={busy || loading || !devices.some((d) => !d.current)}
          onClick={() => setConfirm("others")}
        >
          Sign out other devices
        </button>
      </div>
      {loading ? (
        <p role="status">Loading your devices…</p>
      ) : devices.length === 0 ? (
        <p role="status">No active sessions were returned. Refresh to check again.</p>
      ) : (
        <ul className="mm-device-list">
          {devices.map((device) => (
            <li className="mm-device-row" key={device.id}>
              <span className="mm-device-icon">
                {/Android|iPhone|iPad/.test(device.platform) ? (
                  <Smartphone size={22} aria-hidden="true" />
                ) : (
                  <Laptop2 size={22} aria-hidden="true" />
                )}
              </span>
              <div className="mm-device-details">
                <strong>
                  {device.browser} · {device.platform}
                </strong>
                {device.current && <span className="mm-device-current">This device</span>}
                <small>
                  Last activity {new Date(device.lastActiveAt).toLocaleString()} · Signed in{" "}
                  {new Date(device.createdAt).toLocaleString()}
                </small>
                <small>Expires {new Date(device.expiresAt).toLocaleString()}</small>
              </div>
              <button
                type="button"
                className="mm-device-revoke"
                disabled={busy}
                aria-label={
                  device.current
                    ? "Sign out this device"
                    : "Revoke " + device.browser + " on " + device.platform
                }
                onClick={() => setConfirm(device.current ? "current" : device.id)}
              >
                <LogOut size={15} aria-hidden="true" /> {device.current ? "Sign out" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirm !== null && (
        <div className="mm-device-confirm" role="group" aria-label="Confirm session revocation">
          <strong>
            {confirm === "current"
              ? "Sign out this device?"
              : confirm === "others"
                ? "Sign out all other devices?"
                : "Revoke this session?"}
          </strong>
          <p>Access will end immediately. Affected devices will need to sign in again.</p>
          <div className="mm-device-toolbar">
            <button type="button" disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              className="mm-device-danger"
              onClick={() => void revoke(confirm)}
            >
              {busy ? "Revoking…" : "Confirm sign out"}
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className="mm-device-success">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mm-device-error">
          {error}
        </p>
      )}
      <p className="mm-device-footnote">
        Device names are approximated from browser information. Your session credentials are never
        displayed here.
      </p>
    </section>
  );
}
