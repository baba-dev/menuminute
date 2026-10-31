import { betterAuth } from "better-auth";
import { REMEMBERED_SESSION_SECONDS, SESSION_REFRESH_SECONDS } from "@/lib/auth-session-policy";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { headers, cookies } from "next/headers";
import { getDb } from "@/db";
import { users, sessions, accounts, verificationTokens, rateLimits, twoFactors } from "@/db/schema";
import { env } from "@/lib/config/env";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { twoFactor, captcha } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { recordAuthEvent, alertSecurityEvent } from "@/lib/security-events";
import { sendAuthEmail } from "@/lib/auth-email";
import { isDemoActor } from "@/modules/demo/guard";
export const authServer = betterAuth({
  appName: "MenuMinute",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
  user: {
    additionalFields: {
      termsVersion: { type: "string", required: true, input: true },
      termsAcceptedAt: { type: "date", required: true, input: true },
    },
  },
  trustedOrigins: [new URL(env.APP_URL).origin],
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
            const existing = await getDb().select({ id: users.id }).from(users).limit(1);
            if (existing.length > 0) {
              throw new APIError("FORBIDDEN", {
                message:
                  "Self-hosted Community Edition is restricted to a single administrator. Multi-user accounts are available on food.bababuilds.com.",
              });
            }
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
