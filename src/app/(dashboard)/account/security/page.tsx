import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { env } from "@/lib/config/env";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { isDemoActor } from "@/modules/demo/guard";
import { SecurityConsole } from "@/app/account/security/security-console";
import "../account.css";
import "../../dashboard/organization/organization.css";
import "./security.css";
import "@/app/account/security/device-panel.css";

export const metadata = {
  title: "Account security | MenuMinute",
  description: "Manage sign-in methods, authenticator protection, and active devices.",
  robots: { index: false, follow: false },
};

export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Faccount%2Fsecurity");
  const linked = await getDb()
    .select({
      id: accounts.id,
    providerId: accounts.providerId,
      password: accounts.password,
    })
    .from(accounts)
    .where(eq(accounts.userId, session.user.id));

  return (
    <SecurityConsole
      initialMfa={Boolean(session.user.twoFactorEnabled)}
      hasPassword={linked.some(
        (account) => account.providerId === "credential" && Boolean(account.password)
      )}
      googleLinked={linked.some((account) => account.providerId === "google")}
      googleAccountId={linked.find((account) => account.providerId === "google")?.id ?? null}
      googleEnabled={Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)}
      emailVerified={Boolean(session.user.emailVerified)}
      isDemo={isDemoActor(session.user.id)}
    />
  );
}
