import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Store, UsersRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { listOrganizations } from "@/modules/organizations/service";
import { AuthShell } from "@/components/auth/auth-shell";
import "./start.css";

export const metadata = {
  title: "Choose your path — MenuMinute",
  robots: { index: false, follow: false },
};

export default async function StartPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Fstart");
  const [outlets, memberships] = await Promise.all([
    getRestaurantsByUserId(session.user.id),
    listOrganizations({ userId: session.user.id }),
  ]);
  const canAddOutlet = memberships.some(
    (org) => org.isActive && (org.role === "owner" || org.role === "admin")
  );
  const cards = [
    {
      title: "Create my first restaurant",
      copy: "Start your own restaurant workspace and build a free QR menu. You can complete the optional details later.",
      href: outlets.length ? "/dashboard" : "/onboarding",
      action: outlets.length ? "Open my restaurants" : "Create my restaurant",
      Icon: Store,
    },
    {
      title: "Join an existing team",
      copy: "Already invited by a restaurant owner? Use your invitation link and join with the matching verified email.",
      href: "/join-team",
      action: "Join with invitation",
      Icon: UsersRound,
    },
    {
      title: "Add another outlet",
      copy: "Expand an existing organization with a second location; keep ownership, team permissions and billing together.",
      href: canAddOutlet ? "/dashboard/organization" : "/join-team",
      action: canAddOutlet ? "Manage my outlets" : "Join an organization first",
      Icon: Building2,
    },
  ];
  return (
    <AuthShell
      eyebrow="WELCOME / YOUR WORKSPACE"
      title="What brings you here?"
      description="Choose the path that fits you. You can change workspaces whenever you need."
    >
      <div className="mm-entry-grid">
        {cards.map(({ title, copy, href, action, Icon }) => (
          <Link key={title} href={href} className="mm-entry-card">
            <Icon size={25} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{copy}</span>
            <em>
              {action} <ArrowRight size={16} aria-hidden="true" />
            </em>
          </Link>
        ))}
      </div>
      {!!outlets.length && (
        <p className="mm-entry-note">
          You already have access to {outlets.length} outlet{outlets.length === 1 ? "" : "s"}.{" "}
          <Link href="/dashboard">Go to dashboard</Link>.
        </p>
      )}
      <p className="mm-entry-note">
        No payment card is needed to begin a QR menu. Email verification protects your team and
        restaurant data; authenticator MFA is optional for ordinary accounts.
      </p>
    </AuthShell>
  );
}
