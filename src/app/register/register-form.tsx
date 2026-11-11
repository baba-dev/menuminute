"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegistrationChallenge } from "@/components/auth/turnstile";
import { safeReturnPath } from "@/lib/auth-return";
import { TERMS_VERSION } from "@/content/legal";
const schema = z
  .object({
    name: z.string().trim().min(2, "Enter your name (at least 2 characters).").max(100),
    email: z.email("Enter a valid email address.").max(254),
    password: z.string().min(8, "Use at least 8 characters.").max(128),
    confirmPassword: z.string().min(1, "Confirm your password."),
    acceptTerms: z.literal(true, { error: "Accept the Terms and Privacy Policy to continue." }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });
type Values = z.infer<typeof schema>;
export function RegistrationForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const router = useRouter(),
    params = useSearchParams(),
    next = safeReturnPath(params.get("next"), "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState("");
  const [challengeRetry, setChallengeRetry] = useState(0);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  const termsAccepted = useWatch({ control, name: "acceptTerms" }) === true;
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
              termsVersion: TERMS_VERSION,
              termsAcceptedAt: new Date(), // Server replaces this with a trusted timestamp.
              acceptTerms: values.acceptTerms,
              // The link signs the owner in on the same browser; no second login is needed.
              callbackURL: next || "/dashboard",
              fetchOptions: challenge
                ? { headers: { "x-captcha-response": challenge } }
                : undefined,
            } as Parameters<typeof authClient.signUp.email>[0]);
            if (response.error) {
              setChallenge("");
              setChallengeRetry((value) => value + 1);
              setError(response.error.message ?? "Unable to register. Try again.");
              return;
            }
            // Signed in already: go straight to setup. Verification is nagged, not required.
            router.replace(next || "/onboarding");
            router.refresh();
          } catch {
            setChallenge("");
            setChallengeRetry((value) => value + 1);
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
        {params.has("error") && (
          <p role="alert" className="mm-auth-message mm-auth-message--error">
            {params.get("error") === "account_not_linked"
              ? "This email already belongs to an account. Sign in with your password and link Google in Account Security."
              : params.get("error") === "terms_required"
                ? "Accept the current terms before continuing with Google."
                : "Google registration could not be completed. Try again or register with email."}
          </p>
        )}
        <label className="mm-auth-secondary">
          <input type="checkbox" {...register("acceptTerms")} /> I agree to the{" "}
          <Link href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and acknowledge the{" "}
          <Link href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          .
        </label>
        {errors.acceptTerms && <small role="alert">{errors.acceptTerms.message}</small>}
        {googleEnabled && (
          <div className="mm-auth-register-google">
            <button
              type="button"
              className="mm-auth-google"
              disabled={busy || googleBusy || !termsAccepted}
              onClick={async () => {
                if (googleBusy || !termsAccepted) return;
                setGoogleBusy(true);
                setError("");
                try {
                  const result = await authClient.signIn.social({
                    provider: "google",
                    requestSignUp: true,
                    callbackURL: "/login" + (next ? "?next=" + encodeURIComponent(next) : ""),
                    errorCallbackURL:
                      "/register" + (next ? "?next=" + encodeURIComponent(next) : ""),
                    additionalData: { acceptTerms: true, termsVersion: TERMS_VERSION },
                  });
                  if (result.error)
                    setError(
                      "Google registration could not be started. Please retry or use email."
                    );
                } catch {
                  setError(
                    "Unable to connect to Google. Please retry or create an account with email."
                  );
                } finally {
                  setGoogleBusy(false);
                }
              }}
            >
              <span aria-hidden="true" className="mm-auth-google-g">
                G
              </span>
              {googleBusy ? "Connecting to Google…" : "Continue with Google"}
            </button>
            <p className="mm-auth-entry-help">
              {termsAccepted
                ? "Google will securely verify your email. No password to remember."
                : "Accept the Terms and Privacy Policy above to register with Google."}
            </p>
            <div className="mm-auth-email-divider">
              <span>Or create with email</span>
            </div>
          </div>
        )}
        <label className="mm-auth-field" htmlFor="name">
          <span id="registration-name-label">Your name</span>
          <input
            {...register("name")}
            id="name"
            aria-labelledby="registration-name-label"
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
          <span id="registration-email-label">Email address</span>
          <input
            {...register("email")}
            id="email"
            aria-labelledby="registration-email-label"
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
          <span id="registration-password-label">Password</span>
          <input
            {...register("password")}
            id="password"
            aria-labelledby="registration-password-label"
            type={showPassword ? "text" : "password"}
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
          <span id="registration-confirm-label">Confirm password</span>
          <input
            {...register("confirmPassword")}
            id="confirmPassword"
            aria-labelledby="registration-confirm-label"
            type={showPassword ? "text" : "password"}
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
        <label className="mm-auth-secondary">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />{" "}
          Show passwords
        </label>
        <RegistrationChallenge onToken={setChallenge} resetKey={challengeRetry} />
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
