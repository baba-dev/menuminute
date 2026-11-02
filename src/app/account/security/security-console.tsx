"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Link2,
  LockKeyhole,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { SettingsScopeNav } from "@/components/settings/settings-scope-nav";
import { DevicePanel } from "./device-panel";

type SecurityEvent = { kind: string; occurred_at: string };
type Props = {
  initialMfa: boolean;
  hasPassword: boolean;
  googleEnabled: boolean;
  googleLinked: boolean;
  googleAccountId: string | null;
  emailVerified: boolean;
  isDemo: boolean;
};
const eventNames: Record<string, string> = {
  "session.created": "Signed in",
  "session.revoked": "Signed out a device",
  "sessions.revoked_all": "Signed out other devices",
  "mfa.enrolled": "Authenticator enabled",
  "mfa.failed": "Authenticator attempt rejected",
  "step_up.completed": "Sensitive action confirmed",
  "password.reset": "Password reset",
  "password.changed": "Password changed",
};
function PasswordInput({
  id,
  label,
  value,
  onChange,
  complete = "current-password",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  complete?: string;
}) {
  return (
    <label className="mm-sec-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        className="oh-control"
        type="password"
        autoComplete={complete}
        minLength={complete === "new-password" ? 8 : undefined}
        maxLength={128}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
function BackupCodes({ codes, onClear }: { codes: string[]; onClear: () => void }) {
  if (!codes.length) return null;
  return (
    <div className="mm-sec-recovery" aria-label="Recovery codes">
      <div>
        <strong>Save your new recovery codes now</strong>
        <p>
          Each code works once. Old codes are no longer valid after regeneration. Store them
          offline, not in screenshots or chat.
        </p>
      </div>
      <div data-testid="backup-codes" className="mm-sec-backup-grid">
        {codes.map((code) => (
          <code key={code}>{code}</code>
        ))}
      </div>
      <div className="mm-sec-actions">
        <button
          type="button"
          className="oh-secondary"
          onClick={() => {
            const file = new Blob([codes.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(file);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "menuminute-recovery-codes.txt";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          Download codes
        </button>
        <button type="button" className="oh-secondary" onClick={onClear}>
          I saved them securely
        </button>
      </div>
    </div>
  );
}
function SecurityActivity() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const response = await fetch("/api/security/events", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Security activity could not be loaded.");
      const entries = (await response.json()) as SecurityEvent[];
      if (!signal?.aborted) {
        setEvents(entries);
        setPage(0);
      }
    } catch (cause) {
      if (!signal?.aborted)
        setError(cause instanceof Error ? cause.message : "Unable to load activity.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal);
    return () => abort.abort();
  }, [load]);
  const pages = Math.max(1, Math.ceil(events.length / 5));
  return (
    <section id="activity" className="oh-panel" aria-labelledby="sec-activity-title">
      <header className="oh-panel-heading">
        <div>
          <span className="oh-kicker">04 / SECURITY ACTIVITY</span>
          <h2 id="sec-activity-title">Your recent account activity.</h2>
          <p>Recent sign-ins and protection changes, without revealing confidential credentials.</p>
        </div>
        <div className="oh-art oh-art-activity" aria-hidden="true" />
      </header>
      <div className="oh-panel-content">
        <div className="mm-sec-actions">
          <button
            type="button"
            className="oh-secondary"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            <RefreshCw size={15} aria-hidden="true" /> Refresh activity
          </button>
        </div>
        {error && (
          <p role="alert" className="mm-sec-error">
            {error}
          </p>
        )}
        {loading ? (
          <p>Loading security activity…</p>
        ) : events.length === 0 ? (
          <p>No recent security events were recorded for this account.</p>
        ) : (
          <>
            <div className="mm-sec-table-wrap">
              <table className="mm-sec-table">
                <thead>
                  <tr>
                    <th scope="col">Activity</th>
                    <th scope="col">When</th>
                  </tr>
                </thead>
                <tbody>
                  {events.slice(page * 5, (page + 1) * 5).map((event, index) => (
                    <tr key={event.kind + event.occurred_at + index}>
                      <td>{eventNames[event.kind] ?? "Account security activity"}</td>
                      <td>
                        <time dateTime={event.occurred_at}>
                          {new Date(event.occurred_at).toLocaleString()}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mm-sec-pagination">
              <small>
                Showing {page * 5 + 1}–{Math.min(events.length, (page + 1) * 5)} of {events.length}
              </small>
              <div className="mm-sec-actions">
                <button
                  type="button"
                  className="oh-secondary"
                  disabled={page === 0}
                  onClick={() => setPage((value) => Math.max(value - 1, 0))}
                >
                  Previous
                </button>
                <span aria-live="polite">
                  {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="oh-secondary"
                  disabled={page >= pages - 1}
                  onClick={() => setPage((value) => Math.min(value + 1, pages - 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function SecurityConsole({
  initialMfa,
  hasPassword,
  googleEnabled,
  googleLinked,
  googleAccountId,
  emailVerified,
  isDemo,
}: Props) {
  const [mfa, setMfa] = useState(initialMfa);
  const [linked, setLinked] = useState(googleLinked);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [password, setPassword] = useState("");
  const [uri, setUri] = useState("");
  const [qr, setQr] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [stepPassword, setStepPassword] = useState("");
  const [stepCode, setStepCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function perform(action: () => Promise<void>) {
    if (busy || isDemo) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await action();
    } catch {
      setError("This change could not be completed. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }
  async function enroll() {
    await perform(async () => {
      const result = await authClient.twoFactor.enable({ password });
      setPassword("");
      if (result.error || !result.data || !("totpURI" in result.data)) {
        setError("Could not start enrollment. Check your password.");
        return;
      }
      const next = result.data.totpURI;
      setUri(next);
      setQr(await QRCode.toDataURL(next, { errorCorrectionLevel: "M", margin: 2 }));
      setBackupCodes(result.data.backupCodes);
    });
  }
  return (
    <div
      className="mm-organization mm-account mm-account-security"
      data-testid="account-security-workspace"
    >
      <header className="oh-hero mm-account-hero">
        <div className="oh-hero-copy">
          <span className="oh-kicker">MY ACCOUNT / SECURITY</span>
          <h2 className="oh-hero-meta">Account security</h2>
          <h1>
            Your account.
            <br /> Protected.
          </h1>
          <p>
            One secure place to manage your password, sign-in methods, authenticator, and active
            devices.
          </p>
          <div className="oh-hero-buttons">
            <Link className="oh-secondary" href="/account">
              <ArrowLeft size={17} aria-hidden="true" /> My account
            </Link>
            <a className="oh-primary" href="#authentication">
              Review sign-in options →
            </a>
          </div>
        </div>
      </header>
      <div className="oh-scope-nav">
        <SettingsScopeNav />
      </div>
      <div className="oh-body">
        <section className="oh-pulse" aria-label="Security overview">
          <div>
            <span>ACCOUNT</span>
            <strong>{emailVerified ? "Email verified" : "Verify email"}</strong>
            <small>Identity status</small>
          </div>
          <div>
            <span>PASSWORD</span>
            <strong>{hasPassword ? "Active" : "Not set"}</strong>
            <small>Email/password sign-in</small>
          </div>
          <div>
            <span>AUTHENTICATOR</span>
            <strong>{mfa ? "Enabled" : "Not enabled"}</strong>
            <small>Two-factor authentication</small>
          </div>
          <div>
            <span>GOOGLE</span>
            <strong>{linked ? "Connected" : "Not connected"}</strong>
            <small>Optional sign-in method</small>
          </div>
        </section>
        {isDemo && (
          <p className="mm-sec-note" role="status">
            Security changes are disabled for the shared public demo.
          </p>
        )}
        <p className="mm-sec-feedback" role="status" aria-live="polite">
          {message}
        </p>
        {error && (
          <p role="alert" className="mm-sec-error">
            {error}
          </p>
        )}
        <div className="oh-layout">
          <nav className="oh-nav" aria-label="Security sections">
            <span className="oh-kicker">SECURITY CENTER</span>
            <a href="#authentication">
              <KeyRound size={17} aria-hidden="true" /> Password
            </a>
            <a href="#providers">
              <Link2 size={17} aria-hidden="true" /> Connected accounts
            </a>
            <a href="#authenticator">
              <ShieldCheck size={17} aria-hidden="true" /> Authenticator
            </a>
            <a href="#devices">
              <MonitorSmartphone size={17} aria-hidden="true" /> Active devices
            </a>
            <a href="#activity">
              <Activity size={17} aria-hidden="true" /> Recent activity
            </a>
            <a href="#advanced">
              <LockKeyhole size={17} aria-hidden="true" /> Privileged actions
            </a>
            <p>
              These settings belong to your personal account, not to an individual restaurant or
              workspace.
            </p>
          </nav>
          <div className="oh-sections">
            <section id="authentication" className="oh-panel" aria-labelledby="sec-password-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">01 / PASSWORD</span>
                  <h2 id="sec-password-title">Your password, your control.</h2>
                  <p>
                    Keep your email/password sign-in up to date without losing access to your
                    restaurant.
                  </p>
                </div>
                <div className="oh-art oh-art-owners-office" aria-hidden="true" />
              </header>
              <div className="oh-panel-content">
                {hasPassword ? (
                  <form
                    className="mm-sec-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (newPassword !== confirmPassword) {
                        setError("New passwords do not match.");
                        return;
                      }
                      if (newPassword === oldPassword) {
                        setError("Choose a different new password.");
                        return;
                      }
                      void perform(async () => {
                        const response = await fetch("/api/security/password", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({
                            currentPassword: oldPassword,
                            newPassword,
                            revokeOtherSessions: revokeOthers,
                          }),
                        });
                        setOldPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        if (!response.ok) {
                          setError(
                            response.status === 429
                              ? "Too many attempts. Try again later."
                              : "Password could not be changed. Check the current password."
                          );
                          return;
                        }
                        setMessage("Password changed successfully.");
                      });
                    }}
                  >
                    <PasswordInput
                      id="sec-old-password"
                      label="Current password"
                      value={oldPassword}
                      onChange={setOldPassword}
                    />
                    <PasswordInput
                      id="sec-new-password"
                      label="New password"
                      complete="new-password"
                      value={newPassword}
                      onChange={setNewPassword}
                    />
                    <PasswordInput
                      id="sec-confirm-password"
                      label="Confirm new password"
                      complete="new-password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                    />
                    <p className="oh-hint">
                      Use 8–128 characters. Longer, unique passwords are recommended.
                    </p>
                    <label className="mm-sec-check">
                      <input
                        type="checkbox"
                        checked={revokeOthers}
                        onChange={(event) => setRevokeOthers(event.target.checked)}
                      />{" "}
                      Sign out other devices after changing my password
                    </label>
                    <div className="mm-sec-actions">
                      <button className="oh-primary" disabled={busy || isDemo}>
                        Change password
                      </button>
                      <Link href="/forgot-password" className="oh-secondary">
                        Forgot password?
                      </Link>
                    </div>
                  </form>
                ) : (
                  <p className="oh-hint">
                    This account has no local password. Continue signing in with your linked
                    identity. Adding password sign-in requires a separate verified recovery
                    workflow.
                  </p>
                )}
              </div>
            </section>
            <section id="providers" className="oh-panel" aria-labelledby="sec-provider-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">02 / CONNECTED ACCOUNTS</span>
                  <h2 id="sec-provider-title">Your sign-in options.</h2>
                  <p>
                    Connect an approved Google identity without changing your existing MenuMinute
                    account.
                  </p>
                </div>
                <div className="oh-art oh-art-capabilities" aria-hidden="true" />
              </header>
              <div className="oh-panel-content">
                <div className="mm-sec-provider">
                  <span className="mm-sec-provider-icon">
                    <KeyRound size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Email &amp; password</strong>
                    <small>
                      {hasPassword
                        ? "Available as your reliable sign-in method"
                        : "No local password configured"}
                    </small>
                  </div>
                  <span className="mm-sec-provider-state">
                    {hasPassword ? "Active" : "Not set"}
                  </span>
                </div>
                <div className="mm-sec-provider">
                  <span className="mm-sec-provider-icon">
                    <Link2 size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Google</strong>
                    <small>
                      {linked
                        ? "Connected to your account"
                        : googleEnabled
                          ? "Link Google to sign in on this account"
                          : "Not configured by this deployment"}
                    </small>
                  </div>
                  {linked ? (
                    hasPassword && !mfa && googleAccountId ? (
                      <button
                        type="button"
                        className="oh-secondary"
                        disabled={busy || isDemo}
                        onClick={() => setConfirmUnlink(true)}
                      >
                        Disconnect
                      </button>
                    ) : (
                      <span className="mm-sec-provider-state">Connected</span>
                    )
                  ) : (
                    <button
                      type="button"
                      className="oh-secondary"
                      disabled={
                        busy || isDemo || !emailVerified || !googleEnabled || mfa || !hasPassword
                      }
                      onClick={() =>
                        void perform(async () => {
                          const result = await authClient.linkSocial({
                            provider: "google",
                            callbackURL: "/account/security",
                          });
                          if (result.error) setError("Unable to connect Google. Please retry.");
                        })
                      }
                    >
                      Connect Google
                    </button>
                  )}
                </div>
                {confirmUnlink && (
                  <div
                    className="mm-sec-confirm"
                    role="group"
                    aria-label="Confirm Google disconnection"
                  >
                    <strong>Disconnect Google sign-in?</strong>
                    <p>You can continue signing in with your password.</p>
                    <div className="mm-sec-actions">
                      <button
                        type="button"
                        className="oh-secondary"
                        onClick={() => setConfirmUnlink(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="oh-primary"
                        disabled={busy || isDemo}
                        onClick={() =>
                          void perform(async () => {
                            const result = await authClient.unlinkAccount({
                              accountId: googleAccountId!,
                            });
                            if (result.error) {
                              setError("Google could not be disconnected.");
                              return;
                            }
                            setLinked(false);
                            setConfirmUnlink(false);
                            setMessage("Google sign-in disconnected.");
                          })
                        }
                      >
                        Confirm disconnect
                      </button>
                    </div>
                  </div>
                )}
                {mfa && (
                  <p className="oh-hint">
                    <ShieldCheck size={16} aria-hidden="true" /> Google sign-in is unavailable for
                    authenticator-protected accounts until a separate OAuth second-factor challenge
                    is supported. Continue using password and authenticator sign-in.
                  </p>
                )}
                {!emailVerified && (
                  <p className="oh-hint">Verify your email before connecting a social identity.</p>
                )}
                {!googleEnabled && (
                  <p className="oh-hint">
                    Google can be enabled by an administrator. Password sign-in remains available
                    regardless.
                  </p>
                )}
              </div>
            </section>
            <section id="authenticator" className="oh-panel" aria-labelledby="sec-mfa-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">03 / TWO-FACTOR AUTHENTICATION</span>
                  <h2 id="sec-mfa-title">An extra layer of protection.</h2>
                  <p>
                    Use a six-digit code from an authenticator app to protect password sign-ins.
                  </p>
                </div>
                <div className="oh-art oh-art-team-hall" aria-hidden="true" />
              </header>
              <div className="oh-panel-content">
                <div className="mm-sec-status">
                  {mfa ? (
                    <>
                      <CheckCircle2 size={20} aria-hidden="true" />
                      <strong>Two-factor authentication is enabled.</strong>
                    </>
                  ) : (
                    <>
                      <ShieldOff size={20} aria-hidden="true" />
                      <strong>Two-factor authentication is not enabled.</strong>
                    </>
                  )}
                </div>
                {!hasPassword && (
                  <p className="oh-hint">
                    An account password is required by the current authenticator enrollment flow.
                  </p>
                )}
                {!mfa && !uri && hasPassword && (
                  <form
                    className="mm-sec-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void enroll();
                    }}
                  >
                    <PasswordInput
                      id="enroll-password"
                      label="Confirm password to enroll"
                      value={password}
                      onChange={setPassword}
                    />
                    <div className="mm-sec-actions">
                      <button disabled={busy || isDemo} className="oh-primary">
                        Set up authenticator
                      </button>
                    </div>
                  </form>
                )}
                {uri && !mfa && (
                  <div className="mm-sec-form">
                    <p>
                      Scan this locally generated QR code in your authenticator app. Never share the
                      QR code or setup URI.
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
                    <details className="mm-sec-manual">
                      <summary>Manual setup key (sensitive)</summary>
                      <code>{uri}</code>
                    </details>
                    <BackupCodes codes={backupCodes} onClear={() => setBackupCodes([])} />
                    <form
                      className="mm-sec-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void perform(async () => {
                          const result = await authClient.twoFactor.verifyTotp({
                            code,
                            trustDevice: false,
                          });
                          if (result.error) {
                            setError("Incorrect code. Try again.");
                            return;
                          }
                          setMfa(true);
                          setUri("");
                          setQr("");
                          setCode("");
                          setMessage("Two-factor authentication enabled.");
                        });
                      }}
                    >
                      <label className="mm-sec-field" htmlFor="enroll-code">
                        <span>Authenticator code</span>
                        <input
                          id="enroll-code"
                          className="oh-control"
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          value={code}
                          onChange={(event) => setCode(event.target.value)}
                          required
                        />
                      </label>
                      <div className="mm-sec-actions">
                        <button disabled={busy || isDemo} className="oh-primary">
                          Verify enrollment
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                {mfa && (
                  <>
                    <BackupCodes codes={backupCodes} onClear={() => setBackupCodes([])} />
                    <form
                      className="mm-sec-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void perform(async () => {
                          const result = await authClient.twoFactor.generateBackupCodes({
                            password: recoveryPassword,
                          });
                          setRecoveryPassword("");
                          if (result.error || !result.data) {
                            setError("Could not regenerate recovery codes. Check your password.");
                            return;
                          }
                          setBackupCodes(result.data.backupCodes);
                          setMessage(
                            "Recovery codes regenerated. Save the new codes before leaving."
                          );
                        });
                      }}
                    >
                      <strong>Regenerate recovery codes</strong>
                      <p className="oh-hint">
                        This invalidates all previously issued recovery codes immediately.
                      </p>
                      <PasswordInput
                        id="recovery-password"
                        label="Current password for new recovery codes"
                        value={recoveryPassword}
                        onChange={setRecoveryPassword}
                      />
                      <div className="mm-sec-actions">
                        <button className="oh-secondary" disabled={busy || isDemo}>
                          Generate new recovery codes
                        </button>
                      </div>
                    </form>
                    {!showDisable ? (
                      <button
                        type="button"
                        className="mm-sec-text-danger"
                        disabled={isDemo}
                        onClick={() => setShowDisable(true)}
                      >
                        Disable two-factor authentication
                      </button>
                    ) : (
                      <form
                        className="mm-sec-form mm-sec-danger"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void perform(async () => {
                            const result = await authClient.twoFactor.disable({
                              password: disablePassword,
                            });
                            setDisablePassword("");
                            if (result.error) {
                              setError("Could not disable authenticator. Check your password.");
                              return;
                            }
                            setMfa(false);
                            setBackupCodes([]);
                            setShowDisable(false);
                            setMessage(
                              "Two-factor authentication disabled. Consider setting it up again."
                            );
                          });
                        }}
                      >
                        <strong>Disable authenticator protection?</strong>
                        <p>
                          Future password sign-ins will no longer require a code. Confirm with your
                          current password.
                        </p>
                        <PasswordInput
                          id="disable-password"
                          label="Current password to disable 2FA"
                          value={disablePassword}
                          onChange={setDisablePassword}
                        />
                        <div className="mm-sec-actions">
                          <button
                            type="button"
                            className="oh-secondary"
                            onClick={() => setShowDisable(false)}
                          >
                            Cancel
                          </button>
                          <button className="oh-primary" disabled={busy || isDemo}>
                            Disable 2FA
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </section>
            <section id="devices" className="mm-sec-device-section">
              <DevicePanel />
            </section>
            <SecurityActivity />
            <section id="advanced" className="oh-panel" aria-labelledby="sec-step-up-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">05 / PRIVILEGED ACTIONS</span>
                  <h2 id="sec-step-up-title">Confirm a sensitive change.</h2>
                  <p>
                    For ownership transfers and administrator elevation only. Confirmation lasts
                    five minutes and can be used once.
                  </p>
                </div>
                <div className="oh-art oh-art-owners-office" aria-hidden="true" />
              </header>
              <div className="oh-panel-content">
                {!mfa ? (
                  <p className="oh-hint">
                    Enable your authenticator before confirming privileged actions.
                  </p>
                ) : (
                  <form
                    className="mm-sec-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void perform(async () => {
                        const response = await fetch("/api/security/step-up", {
                          method: "POST",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ password: stepPassword, code: stepCode }),
                        });
                        setStepPassword("");
                        setStepCode("");
                        if (!response.ok) {
                          setError("Confirmation failed. Check your password and code.");
                          return;
                        }
                        setMessage(
                          "Confirmed. Return to organization management and submit the action."
                        );
                      });
                    }}
                  >
                    <PasswordInput
                      id="step-password"
                      label="Current password"
                      value={stepPassword}
                      onChange={setStepPassword}
                    />
                    <label className="mm-sec-field" htmlFor="step-code">
                      <span>Authenticator code</span>
                      <input
                        id="step-code"
                        className="oh-control"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={stepCode}
                        onChange={(event) => setStepCode(event.target.value)}
                        required
                      />
                    </label>
                    <div className="mm-sec-actions">
                      <button disabled={busy || isDemo} className="oh-primary">
                        Confirm privileged action
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
            <div className="mm-sec-footer">
              <Smartphone size={18} aria-hidden="true" />
              If you notice an unfamiliar sign-in, revoke other devices and update your password.
              <Link href="/account">Back to account settings</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
