import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { headers, cookies } from "next/headers";
import { getDb } from "@/db";
import { users, sessions, accounts, verificationTokens, rateLimits } from "@/db/schema";
import { env } from "@/lib/config/env";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import bcrypt from "bcryptjs";
import { sendAuthEmail } from "@/lib/auth-email";
export const authServer = betterAuth({
  appName: "MenuMinute",
  baseURL: env.APP_URL,
  secret: env.AUTH_SECRET,
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
    },
  }),
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail(user.email, "Verify your MenuMinute email", url);
    },
  },
  emailAndPassword: {
    requireEmailVerification: true,
    autoSignIn: false,
    resetPasswordTokenExpiresIn: 60 * 30,
    revokeSessionsOnPasswordReset: true,
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
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
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
  plugins: [nextCookies()],
});
export async function auth() {
  const session = await authServer.api.getSession({ headers: await headers() });
  return session?.user.emailVerified
    ? { ...session, activeOutletId: (await cookies()).get("menuminute.outlet")?.value }
    : null;
}
