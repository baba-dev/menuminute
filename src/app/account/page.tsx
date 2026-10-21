import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { listOrganizations } from "@/modules/organizations/service";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { ThemeControl } from "@/components/menu-product/theme-control";
export const metadata = { title: "Your account — MenuMinute" };
export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Faccount");
  const [organizations, outlets] = await Promise.all([
    listOrganizations({ userId: session.user.id }),
    getRestaurantsByUserId(session.user.id),
  ]);
  return (
    <main className="product public-shell stack" style={{ maxWidth: "1000px" }}>
      <SessionContinuity />
      <div className="row between">
        <Link className="underline" href="/dashboard">
          ← Dashboard
        </Link>
        <ThemeControl />
      </div>
      <header className="stack">
        <span className="eyebrow">ACCOUNT / SETTINGS</span>
        <h1>Your account, your way.</h1>
        <p>Manage your verified identity, security and restaurant contexts.</p>
      </header>
      <div className="columns">
        <section className="panel stack">
          <h2>Profile</h2>
          <dl className="stack">
            <div>
              <dt>Name</dt>
              <dd>
                <strong>{session.user.name}</strong>
              </dd>
            </div>
            <div>
              <dt>Verified email</dt>
              <dd className="break-all">{session.user.email}</dd>
            </div>
          </dl>
          <p>Email changes require re-verification; contact support for identity corrections.</p>
          <Link className="action" href="/account/security">
            Manage account security and sessions →
          </Link>
        </section>
        <section className="panel stack">
          <h2>Organizations & outlets</h2>
          <p>
            {organizations.length} organizations · {outlets.length} active outlets
          </p>
          {organizations.map((o) => (
            <div key={o.id} className="row between">
              <strong>{o.name}</strong>
              <span className="badge">{o.role}</span>
            </div>
          ))}
          <Link className="action" href="/dashboard/organization">
            Manage team invitations and access →
          </Link>
          <Link className="action" href="/dashboard">
            Switch active outlet →
          </Link>
        </section>
      </div>
      <section className="panel stack">
        <h2>Your privacy</h2>
        <p>
          Read our{" "}
          <Link className="underline" href="/privacy">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link className="underline" href="/terms">
            Terms of Service
          </Link>
          , or review the{" "}
          <Link className="underline" href="/delete-account">
            account deletion process
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
