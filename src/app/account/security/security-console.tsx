"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
type Device = {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date;
  expiresAt: Date;
};
export function SecurityConsole({ initialMfa }: { initialMfa: boolean }) {
  const router = useRouter();
  const [mfa, setMfa] = useState(initialMfa);
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [stepPassword, setStepPassword] = useState("");
  const [stepCode, setStepCode] = useState("");
  const [message, setMessage] = useState("");
  const [devices, setDevices] = useState<Device[]>([]);
  const load = useCallback(async () => {
    const result = await authClient.listSessions();
    if (result.data) setDevices(result.data as Device[]);
  }, []);
  useEffect(() => {
    // Resolve remote state asynchronously rather than synchronously cascading an effect update.
    void authClient.listSessions().then((result) => {
      if (result.data) setDevices(result.data as Device[]);
    });
  }, []);
  async function enroll() {
    setMessage("");
    const result = await authClient.twoFactor.enable({ password });
    if (result.error || !result.data || !("totpURI" in result.data)) {
      setMessage("Could not start enrollment. Check your password.");
      return;
    }
    const next = result.data.totpURI;
    setUri(next);
    setQr(await QRCode.toDataURL(next, { errorCorrectionLevel: "M", margin: 2 }));
    setBackupCodes(result.data.backupCodes);
    setPassword("");
  }
  return (
    <main className="mx-auto grid w-full max-w-3xl min-w-0 gap-6 overflow-x-clip p-4 sm:p-6">
      <Link href="/dashboard" className="text-sm font-semibold text-orange-700 underline">
        ← Dashboard
      </Link>
      <header>
        <h1 className="text-3xl font-extrabold">Account security</h1>
        <p>Manage your authenticator and revoke sessions you do not recognize.</p>
      </header>
      <section className="grid min-w-0 gap-4 rounded-xl border p-4 sm:p-5">
        <h2 className="text-xl font-bold">Authenticator app</h2>
        <p>
          {mfa
            ? "Two-factor authentication is enabled."
            : "Owners and administrators should enroll a second factor before privileged changes."}
        </p>
        {!mfa && !uri && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void enroll();
            }}
          >
            <label htmlFor="enroll-password">Confirm password to enroll</label>
            <input
              id="enroll-password"
              className="rounded border p-3"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="rounded bg-orange-600 p-3 font-semibold text-white">
              Set up authenticator
            </button>
          </form>
        )}
        {uri && !mfa && (
          <div className="grid min-w-0 gap-3">
            <p>
              Scan this locally rendered QR code with your authenticator app. Never share this code
              or the setup URI.
            </p>
            {qr && (
              <Image
                alt="Authenticator enrollment QR code"
                unoptimized
                src={qr}
                width={200}
                height={200}
              />
            )}
            <details className="max-w-full min-w-0">
              <summary>Manual setup key (sensitive)</summary>
              <code className="block max-w-full min-w-0 [overflow-wrap:anywhere] break-all">
                {uri}
              </code>
            </details>
            <p>
              Save the following single-use recovery codes offline. They will not be shown again.
            </p>
            <div
              data-testid="backup-codes"
              className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {backupCodes.map((c) => (
                <code
                  key={c}
                  className="block min-w-0 rounded-md bg-stone-100 p-2 font-mono text-sm [overflow-wrap:anywhere] break-all dark:bg-stone-900"
                >
                  {c}
                </code>
              ))}
            </div>
            <form
              className="grid min-w-0 gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
                if (r.error) setMessage("Incorrect code");
                else {
                  setMfa(true);
                  setUri("");
                  setQr("");
                  setBackupCodes([]);
                  setMessage("Two-factor authentication enabled.");
                }
              }}
            >
              <label htmlFor="enroll-code">Authenticator code</label>
              <input
                id="enroll-code"
                className="rounded border p-3"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                pattern="[0-9]{6}"
              />
              <button className="rounded bg-orange-600 p-3 font-semibold text-white">
                Verify enrollment
              </button>
            </form>
          </div>
        )}
      </section>
      {mfa && (
        <section className="grid min-w-0 gap-3 rounded-xl border p-4 sm:p-5">
          <h2 className="text-xl font-bold">Confirm a privileged action</h2>
          <p>
            Confirmation expires after five minutes and is consumed by one privileged action.
            Ownership transfers and admin elevation cannot proceed without it.
          </p>
          <form
            className="grid gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await fetch("/api/security/step-up", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ password: stepPassword, code: stepCode }),
              });
              setStepPassword("");
              setStepCode("");
              setMessage(
                r.ok
                  ? "Confirmed. Return to organization management and submit the action."
                  : "Confirmation failed."
              );
            }}
          >
            <label htmlFor="step-password">Current password</label>
            <input
              id="step-password"
              className="rounded border p-3"
              type="password"
              autoComplete="current-password"
              value={stepPassword}
              onChange={(e) => setStepPassword(e.target.value)}
              required
            />
            <label htmlFor="step-code">Authenticator code</label>
            <input
              id="step-code"
              className="rounded border p-3"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              value={stepCode}
              onChange={(e) => setStepCode(e.target.value)}
              required
            />
            <button className="rounded bg-orange-600 p-3 font-semibold text-white">
              Confirm privileged action
            </button>
          </form>
        </section>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <section className="grid min-w-0 gap-3 rounded-xl border p-4 sm:p-5">
        <h2 className="text-xl font-bold">Active sessions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            className="underline"
            onClick={async () => {
              await authClient.revokeOtherSessions();
              await load();
            }}
          >
            Sign out other devices
          </button>
          <button
            className="underline"
            onClick={async () => {
              await authClient.revokeSessions();
              router.replace("/login");
              router.refresh();
            }}
          >
            Sign out all devices
          </button>
        </div>
        {devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 border-t pt-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{d.userAgent || "Unknown device"}</p>
              <p className="text-xs">
                Created {new Date(d.createdAt).toLocaleString()} · Expires{" "}
                {new Date(d.expiresAt).toLocaleString()}
              </p>
            </div>
            <button
              className="shrink-0 text-sm text-red-600 underline"
              onClick={async () => {
                await authClient.revokeSession({ token: d.token });
                await load();
              }}
            >
              Revoke
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
