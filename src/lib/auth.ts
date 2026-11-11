import { betterAuth } from "better-auth";
import { REMEMBERED_SESSION_SECONDS, SESSION_REFRESH_SECONDS } from "@/lib/auth-session-policy";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { headers, cookies } from "next/headers";
import { getDb } from "@/db";
import { googleMfaBlocked } from "@/lib/google-auth-guard";
import { users, sessions, accounts, verificationTokens, rateLimits, twoFactors } from "@/db/schema";
import { env } from "@/lib/config/env";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { twoFactor, captcha } from "better-auth/plugins";
import { APIError, addOAuthServerContext, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { TERMS_VERSION } from "@/content/legal";
import {
  googleSignupConsentFromState,
  googleSignupServerContext,
} from "@/lib/google-signup-consent";
import { recordAuthEvent, alertSecurityEvent } from "@/lib/security-events";
import { sendAuthEmail } from "@/lib/auth-email";
import { isDemoActor } from "@/modules/demo/guard";
export const authServer = betterAuth({
  appName: "MenuMinute",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  user: {
    // Better Auth's TOTP challenge is credential-only. Reject Google OAuth for a
    // TOTP-protected account instead of creating an unchallenged authenticated session.
    validateUserInfo: async ({ user, source }) => {
      if (source.oauth?.providerId !== "google") return;
      const profile = source.oauth.profile as Record<string, unknown> | undefined;
      const externalId =
        typeof profile?.sub === "string"
          ? profile.sub
          : typeof profile?.id === "string"
            ? profile.id
            : "";
      if (await googleMfaBlocked(user.email ?? "", externalId))
        return {
          error: "mfa_requires_password",
          errorDescription: "This account requires password and authenticator sign-in.",
        };
      if (source.action === "create-user") {
        const state = await getOAuthState().catch(() => null);
        if (!googleSignupConsentFromState(state))
          return {
            error: "terms_required",
            errorDescription: "Accept the current terms on the registration page before continuing.",
          };
      }
    },
    additionalFields: {
      termsVersion: { type: "string", required: true, input: true },
      termsAcceptedAt: { type: "date", required: true, input: true },
      // Never accept this slot from browsers or OAuth profile data. Only the server
      // stamps it during Community Edition user creation (unique in PostgreSQL).
      communityEditionSlot: { type: "number", required: false, input: false, returned: false },
    },
  },
  trustedOrigins: [new URL(env.APP_URL).origin],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/social") return;
      const body = ctx.body as
        | { provider?: unknown; requestSignUp?: unknown; additionalData?: unknown }
        | undefined;
      if (body?.provider !== "google" || body.requestSignUp !== true) return;
      const consent = googleSignupServerContext(body.additionalData);
      if (!consent)
        throw new APIError("BAD_REQUEST", {
          message: "Accept the current Terms and Privacy Policy before registering with Google.",
        });
      // Only server-validated consent is persisted into OAuth state. The client cannot
      // forge serverContext, and the callback cannot skip this user-creation gate.
      await addOAuthServerContext(consent);
    }),
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            // Returning sign-ins are never allowed to silently create a new user.
            // Explicit Google registration supplies requestSignUp + server-trusted consent.
            disableImplicitSignUp: true,
            disableIdTokenSignIn: true,
            mapProfileToUser: async () => {
              const state = await getOAuthState().catch(() => null);
              return googleSignupConsentFromState(state) ?? {};
            },
            requireEmailVerification: true,
          },
        }
      : {},
  account: {
    accountLinking: {
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: [],
      allowDifferentEmails: false,
      allowUnlinkingAll: false,
    },
  },
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    transaction: true,
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verificationTokens,
      rateLimit: rateLimits,
      twoFactor: twoFactors,
    },
  }),
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    // Verification is deferred and nagged, never a signup gate: a slow mail provider must not
    // delay account creation, and clicking the link in the same browser signs the owner in.
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // Deliberately not awaited: SMTP latency must not block signup or setup. A failed send is
      // recoverable from the in-app verification banner, which can resend on demand.
      void sendAuthEmail(user.email, "Verify your MenuMinute email", url).catch(() => {
        console.error("[auth] Verification email delivery failed; user can resend from the banner");
      });
    },
  },
  emailAndPassword: {
    // Unverified accounts get working access to their own workspace. Invitations, billing,
    // ownership/admin roles and step-up still require a verified email (see requestActor).
    requireEmailVerification: false,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await recordAuthEvent(user.id, "password.reset");
      void alertSecurityEvent(user.id, "Your MenuMinute password was reset");
    },
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail(user.email, "Reset your MenuMinute password", url);
    },
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) =>
        /^\$2[aby]\$/.test(hash)
          ? bcrypt.compare(password, hash)
          : verifyPassword({ hash, password }),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (env.COMMUNITY_EDITION) {
            // This read only provides a friendly rejection for ordinary attempts.
            // Concurrent first signups are serialized by the database UNIQUE slot
            // in migration 0109, not by this non-atomic read-before-insert.
            const existing = await getDb().select({ id: users.id }).from(users).limit(1);
            if (existing.length > 0) {
              throw new APIError("FORBIDDEN", {
                message:
                  "Self-hosted Community Edition is restricted to a single administrator. Multi-user accounts are available on food.bababuilds.com.",
              });
            }
            return { data: { ...user, communityEditionSlot: 1 } };
          }
          return { data: user };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          // The shared public-demo account never records events or sends sign-in alert email.
          if (isDemoActor(session.userId)) return;
          await recordAuthEvent(session.userId, "session.created", session.id);
          void alertSecurityEvent(session.userId, "New MenuMinute sign-in");
        },
      },
      delete: {
        after: async (session) => {
          if (isDemoActor(session.userId)) return;
          await recordAuthEvent(session.userId, "session.revoked", session.id);
        },
      },
    },
  },
  session: {
    // Browser persistence is controlled by Better Auth signIn.email({ rememberMe }).
    // Do not introduce parallel refresh tokens or cache unrevoked identity in cookies.
    expiresIn: REMEMBERED_SESSION_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    disableOriginCheck: false,
    disableCSRFCheck: false,
    useSecureCookies: env.NODE_ENV === "production",
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [
    twoFactor({
      issuer: "MenuMinute",
      backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
      // Explicitly enforce the native Better Auth 1.7 account lockout across
      // TOTP and backup-code challenges, including new sessions.
      accountLockout: { enabled: true, maxFailedAttempts: 10, durationSeconds: 900 },
    }),
    ...(env.TURNSTILE_SECRET_KEY
      ? [
          captcha({
            provider: "cloudflare-turnstile",
            secretKey: env.TURNSTILE_SECRET_KEY,
            endpoints: ["/sign-up/email"],
          }),
        ]
      : []),
    nextCookies(),
  ],
});
export async function auth() {
  // RSC/API reads authenticate without consuming the rolling-renewal window:
  // only writable browser Route Handlers can deliver a renewed Set-Cookie.
  const session = await authServer.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  return session
    ? { ...session, activeOutletId: (await cookies()).get("menuminute.outlet")?.value }
    : null;
}
/** Like auth(), but only for sessions whose email address has been verified. */
export async function authVerified() {
  const session = await auth();
  return session?.user.emailVerified ? session : null;
}
