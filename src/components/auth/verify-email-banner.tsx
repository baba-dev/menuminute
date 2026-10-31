"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import "./verify-email-banner.css";

const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 20_000;
const SLOW_HINT_AFTER_MS = 90_000;

/**
 * Persistent, non-blocking nag shown to signed-in accounts whose email is not yet verified.
 * Verification never gates the workspace; it unlocks invitations and billing. The banner can
 * resend on demand (a slow SMTP provider is expected) and notices verification completed in
 * another tab or device without a manual reload.
 */
export function VerifyEmailBanner({
  email,
  returnTo = "/dashboard",
}: {
  email: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [verified, setVerified] = useState(false);
  const refreshed = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), SLOW_HINT_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const check = useCallback(async () => {
    if (refreshed.current || document.visibilityState !== "visible") return;
    try {
      const res = await fetch("/api/auth/get-session", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { user?: { emailVerified?: boolean } } | null;
      if (data?.user?.emailVerified) {
        refreshed.current = true;
        setVerified(true);
        window.setTimeout(() => router.refresh(), 2500);
      }
    } catch {
      // A network error never proves anything about verification state.
    }
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => void check(), POLL_INTERVAL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [check]);

  async function resend() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: returnTo + (returnTo.includes("?") ? "&" : "?") + "verified=1",
      });
      if (result.error) throw new Error("send failed");
      setStatus("Verification email sent. It can take a few minutes to arrive.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("We could not send the email right now. Try again in a moment.");
      setCooldown(10);
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <div className="mm-verify-banner" data-state="verified" role="status">
        <span className="mm-verify-banner__copy">
          <strong>Email verified.</strong> Invitations and billing are now unlocked.
        </span>
      </div>
    );
  }

  return (
    <div
      className="mm-verify-banner"
      data-testid="verify-email-banner"
      role="region"
      aria-label="Email verification"
    >
      <span className="mm-verify-banner__copy">
        <strong>Verify your email.</strong> We sent a link to <b>{email}</b>.
        <span className="mm-verify-banner__more">
          {" "}
          You can keep setting up now; team invitations and billing unlock once it is verified.
        </span>
        {slow && !status && !error && (
          <span className="mm-verify-banner__status">
            Still nothing? Check your spam folder or resend the link.
          </span>
        )}
        {status && (
          <span className="mm-verify-banner__status" role="status">
            {status}
          </span>
        )}
        {error && (
          <span className="mm-verify-banner__status" role="alert">
            {error}
          </span>
        )}
      </span>
      <button
        type="button"
        className="mm-verify-banner__resend"
        onClick={() => void resend()}
        disabled={busy || cooldown > 0}
      >
        {busy ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend email"}
      </button>
    </div>
  );
}
