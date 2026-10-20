import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { InviteAccept } from "./invite-accept";
export const metadata = {
  title: "Accept invitation — MenuMinute",
  robots: { index: false, follow: false },
};
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token;
  if (!/^[a-f0-9]{64}$/.test(token)) redirect("/login");
  const session = await auth();
  if (!session) redirect("/login?next=" + encodeURIComponent("/invite/" + token));
  return <InviteAccept token={token} accountEmail={session.user.email} />;
}
