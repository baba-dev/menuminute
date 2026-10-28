"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { completePendingLoginPreference } from "@/lib/remembered-account";
import { authNextKey, safeReturnPath } from "@/lib/auth-return";
import { AuthShell } from "@/components/auth/auth-shell";
export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState(""),
    [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <AuthShell
      eyebrow="PROTECTED SIGN IN"
      title="One more check."
      description={
        backup
          ? "Use one of your saved single-use recovery codes."
          : "Enter the six-digit code from your authenticator app."
      }
      extra={<Link href="/login">Return to sign in</Link>}
    >
      <form
        className="mm-auth-form"
        aria-busy={busy}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = backup
              ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice: false })
              : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
            if (result.error) {
              setError("Invalid or expired code. Try again.");
              return;
            }
            completePendingLoginPreference();
            let next = "";
            try {
              next = safeReturnPath(sessionStorage.getItem(authNextKey), "");
              sessionStorage.removeItem(authNextKey);
            } catch {}
            if (!next) {
              const r = await fetch("/api/context", { cache: "no-store" });
              if (r.ok) {
                const ctx = await r.json();
                next = ctx.hasOutlets ? "/dashboard" : "/start";
              }
            }
            router.replace(next || "/dashboard");
            router.refresh();
          } catch {
            setError("Verification failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="mm-auth-field" htmlFor="factor-code">
          {backup ? "Recovery code" : "Authenticator code"}
          <input
            id="factor-code"
            required
            autoComplete={backup ? "off" : "one-time-code"}
            inputMode={backup ? "text" : "numeric"}
            pattern={backup ? undefined : "[0-9]{6}"}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "factor-error" : undefined}
          />
        </label>
        {error && (
          <p className="mm-auth-message mm-auth-message--error" id="factor-error" role="alert">
            {error}
          </p>
        )}
        <button className="mm-auth-submit" disabled={busy}>
          {busy ? "Verifying…" : "Continue"}
        </button>
      </form>
      <div className="mm-auth-secondary">
        <button
          type="button"
          onClick={() => {
            setBackup(!backup);
            setCode("");
            setError("");
          }}
        >
          {backup ? "Use authenticator" : "Use recovery code"}
        </button>
      </div>
    </AuthShell>
  );
}
