"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowRight, ShieldCheck, UserRound, X } from "lucide-react";
import {
  clearRememberedAccount,
  completePendingLoginPreference,
  discardPendingLoginPreference,
  readRememberedAccount,
  rememberedAccountServerSnapshot,
  stageLoginPreference,
  subscribeRememberedAccount,
} from "@/lib/remembered-account";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { authNextKey, safeReturnPath } from "@/lib/auth-return";
const schema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});
type Values = z.infer<typeof schema>;
export function LoginForm() {
  const router = useRouter(),
    params = useSearchParams();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const rememberedEmail = useSyncExternalStore(
    subscribeRememberedAccount,
    readRememberedAccount,
    rememberedAccountServerSnapshot
  );
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), shouldFocusError: true });
  const next = safeReturnPath(params.get("next"), "");
  useEffect(() => {
    if (rememberedEmail && !getValues("email")) setValue("email", rememberedEmail);
  }, [rememberedEmail, getValues, setValue]);
  return (
    <AuthShell
      eyebrow="SIGN IN / WELCOME BACK"
      title="Good to have you back."
      description="Pick up where you left off. Your restaurant stays yours, across every device."
      extra={
        <div className="mm-auth-secondary">
          <span>New to MenuMinute?</span>
          <Link href={next ? "/register?next=" + encodeURIComponent(next) : "/register"}>
            Create an account
          </Link>
        </div>
      }
    >
      <form
        className="mm-auth-form"
        aria-busy={busy}
        noValidate
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          try {
            try {
              sessionStorage.setItem(authNextKey, next);
            } catch {}
            stageLoginPreference(values.email, rememberMe);
            const result = await authClient.signIn.email({ ...values, rememberMe });
            if (result.error) {
              discardPendingLoginPreference();
              if (result.error.code === "EMAIL_NOT_VERIFIED") {
                router.push(
                  "/verify-email?email=" +
                    encodeURIComponent(values.email) +
                    (next ? "&next=" + encodeURIComponent(next) : "")
                );
                return;
              }
              setError(
                result.error.status === 429
                  ? "Too many attempts. Please try again later."
                  : result.error.status >= 500
                    ? "Sign-in is temporarily unavailable. Your session has not been intentionally cleared."
                    : "We could not sign you in. Check your email and password."
              );
              return;
            }
            if (
              result.data &&
              "twoFactorRedirect" in result.data &&
              result.data.twoFactorRedirect
            ) {
              router.push("/two-factor");
              return;
            }
            completePendingLoginPreference();
            let destination = next;
            if (!destination) {
              const res = await fetch("/api/context", { cache: "no-store" });
              if (res.ok) {
                const current = await res.json();
                destination = current.hasOutlets ? "/dashboard" : "/start";
              }
            }
            router.replace(destination || "/dashboard");
            router.refresh();
          } catch {
            discardPendingLoginPreference();
            setError(
              "Unable to connect. Check your connection and retry. Your entries are still here."
            );
          } finally {
            setBusy(false);
          }
        })}
      >
        {params.has("verified") && (
          <p role="status" className="mm-auth-message">
            Email verified. Sign in to continue your setup.
          </p>
        )}
        {params.has("reset") && (
          <p role="status" className="mm-auth-message">
            Password updated. Sign in with your new password.
          </p>
        )}
        {error && (
          <p role="alert" className="mm-auth-message mm-auth-message--error" tabIndex={-1}>
            {error}
          </p>
        )}
        {rememberedEmail && (
          <div className="mm-auth-remembered" role="status">
            <span className="mm-auth-remembered-icon" aria-hidden="true">
              <UserRound size={19} />
            </span>
            <span className="mm-auth-remembered-copy">
              <strong>Welcome back</strong>
              <small>{rememberedEmail}</small>
            </span>
            <button
              className="mm-auth-remembered-clear"
              type="button"
              aria-label="Use another account"
              title="Use another account"
              disabled={busy}
              onClick={() => {
                clearRememberedAccount();
                setValue("email", "");
                setValue("password", "");
                setFocus("email");
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        )}
        <label className="mm-auth-field" htmlFor="email">
          <span id="login-email-label">Email address</span>
          <input
            id="email"
            aria-labelledby="login-email-label"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <small role="alert" id="login-email-error">
              {errors.email.message}
            </small>
          )}
        </label>
        <label className="mm-auth-field" htmlFor="password">
          <span id="login-password-label">Password</span>
          <input
            id="password"
            aria-labelledby="login-password-label"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "login-password-error" : undefined}
            {...register("password")}
          />
          {errors.password && (
            <small role="alert" id="login-password-error">
              {errors.password.message}
            </small>
          )}
        </label>
        <div className="mm-auth-login-options">
          <label className="mm-auth-remember-label" htmlFor="remember-me">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              disabled={busy}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <Link href="/forgot-password">Forgot your password?</Link>
        </div>
        <p className="mm-auth-remember-caption">
          <ShieldCheck size={15} aria-hidden="true" />
          {rememberMe
            ? "Stay signed in for up to 30 days on this browser."
            : "Sign in for this browser session only."}
        </p>
        <button className="mm-auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
          {!busy && <ArrowRight size={18} aria-hidden="true" />}
        </button>
      </form>
    </AuthShell>
  );
}
