import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { InvitationEntry } from "./invitation-entry";

export const metadata = { title: "Join a restaurant team — MenuMinute", robots: { index: false, follow: false } };

export default async function JoinTeamPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Fjoin-team");
  return (
    <AuthShell eyebrow="JOIN YOUR TEAM / INVITATION" title="Join a restaurant team."
      description="Ask your manager for an invitation sent to the email address on your MenuMinute account. No second restaurant needs to be created.">
      <p className="mm-auth-message">Signed in as <strong>{session.user.email}</strong>. Team access is granted only after you accept an active invitation addressed to this verified email.</p>
      <InvitationEntry />
      <p className="mm-auth-secondary">Need to use a different email? <Link href="/login?switch=1">Switch accounts</Link>.</p>
      <p className="mm-auth-secondary"><Link href="/start">Choose another path</Link></p>
    </AuthShell>
  );
}
