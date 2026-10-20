"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationChallenge } from "@/components/auth/turnstile";
import { safeReturnPath } from "@/lib/auth-return";
const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name (at least 2 characters).").max(100),
    email: z.email("Enter a valid email address.").max(254),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Confirm your password."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
type Values = z.infer<typeof schema>;
function RegistrationForm() {
  const router = useRouter(),
    params = useSearchParams(),
    next = safeReturnPath(params.get("next"), "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  return (
    <AuthShell
      eyebrow="CREATE YOUR ACCOUNT / FREE QR MENU"
      title="Your next chapter starts here."
      description="Create a verified account, then set up your first outlet. No payment card required."
      extra={
        <div className="mm-auth-secondary">
          <span>Already have an account?</span>
          <Link href={next ? "/login?next=" + encodeURIComponent(next) : "/login"}>Sign in</Link>
        </div>
      }
    >
      <form
        className="mm-auth-form"
        noValidate
        aria-busy={busy}
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          setError("");
          try {
            const response = await authClient.signUp.email({
              name: values.name,
              email: values.email,
              password: values.password,
              fetchOptions: challenge
                ? { headers: { "x-captcha-response": challenge } }
                : undefined,
            });
            if (response.error) {
              setError(response.error.message ?? "Unable to register. Try again.");
              return;
            }
            router.push(
              "/verify-email?email=" +
                encodeURIComponent(values.email) +
                (next ? "&next=" + encodeURIComponent(next) : "")
            );
          } catch {
            setError("Unable to create an account. Your entries remain here.");
          } finally {
            setBusy(false);
          }
        })}
      >
        {error && (
          <p role="alert" className="mm-auth-message mm-auth-message--error" tabIndex={-1}>
            {error}
          </p>
        )}
        <label className="mm-auth-field" htmlFor="name">
          Your name
          <input
            {...register("name")}
            id="name"
            type="text"
            maxLength={100}
            autoComplete="name"
            placeholder="Restaurant Owner"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "registration-name-error" : undefined}
          />
          {errors.name && (
            <small id="registration-name-error" role="alert">
              {errors.name.message}
            </small>
          )}
        </label>
        <label className="mm-auth-field" htmlFor="email">
          Email address
          <input
            {...register("email")}
            id="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            placeholder="you@restaurant.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "registration-email-error" : undefined}
          />
          {errors.email && (
            <small id="registration-email-error" role="alert">
              {errors.email.message}
            </small>
          )}
        </label>
        <label className="mm-auth-field" htmlFor="password">
          Password
          <input
            {...register("password")}
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "registration-password-error" : undefined}
          />
          {errors.password && (
            <small id="registration-password-error" role="alert">
              {errors.password.message}
            </small>
          )}
        </label>
        <label className="mm-auth-field" htmlFor="confirmPassword">
          Confirm password
          <input
            {...register("confirmPassword")}
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "registration-confirm-error" : undefined}
          />
          {errors.confirmPassword && (
            <small id="registration-confirm-error" role="alert">
              {errors.confirmPassword.message}
            </small>
          )}
        </label>
        <p className="mm-auth-secondary">
          Learn how your information is handled in our{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          . You can also read our{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          draft, which is not yet effective. Acceptance will be requested only after publication of
          approved terms.
        </p>
        <RegistrationChallenge onToken={setChallenge} />
        <button
          className="mm-auth-submit"
          disabled={busy || (!!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !challenge)}
        >
          {busy ? "Creating account…" : "Create free account"}
        </button>
      </form>
    </AuthShell>
  );
}
export default function RegisterPage() {
  return (
    <Suspense>
      <RegistrationForm />
    </Suspense>
  );
}
