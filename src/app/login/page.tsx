"use client";
import { Suspense, useState } from "react";
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
function LoginForm() {
  const router = useRouter(),
    params = useSearchParams();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), shouldFocusError: true });
  const next = safeReturnPath(params.get("next"), "");
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
            const result = await authClient.signIn.email(values);
            if (result.error) {
              if (result.error.code === "EMAIL_NOT_VERIFIED") {
                router.push(
                  "/verify-email?email=" +
                    encodeURIComponent(values.email) +
                    (next ? "&next=" + encodeURIComponent(next) : "")
                );
                return;
              }
              setError("We could not sign you in. Check your email and password.");
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
            let destination = next;
            if (!destination) {
              const res = await fetch("/api/context", { cache: "no-store" });
              if (res.ok) {
                const current = await res.json();
                destination = current.hasOutlets ? "/dashboard" : "/onboarding";
              }
            }
            router.replace(destination || "/dashboard");
            router.refresh();
          } catch {
            setError("Unable to connect. Try again without losing your entries.");
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
        <label className="mm-auth-field" htmlFor="email">
          Email address
          <input
            id="email"
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
          Password
          <input
            id="password"
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
        <div className="mm-auth-secondary">
          <Link href="/forgot-password">Forgot your password?</Link>
        </div>
        <button className="mm-auth-submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
