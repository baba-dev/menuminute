import { auth } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { redirect } from "next/navigation";
import { SecurityConsole } from "./security-console";
export const metadata = { title: "Account security — MenuMinute" };
export default async function AccountSecurityPage() {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <>
      <SessionContinuity />
      <SecurityConsole initialMfa={Boolean(session.user.twoFactorEnabled)} />
    </>
  );
}
