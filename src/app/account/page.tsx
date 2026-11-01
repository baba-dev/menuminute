import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SessionContinuity } from "@/components/auth/session-continuity";
import { listOrganizations } from "@/modules/organizations/service";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { AccountSignOutButton } from "./sign-out-button";
import { AccountWorkspacePreference } from "./workspace-preference";
import { readWorkspacePreference } from "@/modules/organizations/workspace-preferences";
import { SettingsScopeNav } from "@/components/settings/settings-scope-nav";
export const metadata = { title: "Your account — MenuMinute" };
export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Faccount");
  const [organizations, outlets, preference] = await Promise.all([
    listOrganizations({ userId: session.user.id }),
    getRestaurantsByUserId(session.user.id),
    readWorkspacePreference(session.user.id),
  ]);
  return (
    <main className="product public-shell stack" style={{ maxWidth: "1100px" }}>
      <SessionContinuity />
      <div className="row between">
        <Link className="underline" href="/dashboard">
          ← Dashboard
        </Link>
      </div>
      <header className="stack">
        <span className="eyebrow">PERSONAL SETTINGS</span>
        <h1>My account</h1>
        <p>Your identity, sign-in security and personal workspace preferences.</p>
      </header>
      <SettingsScopeNav />
      <div className="columns">
        <section className="panel stack">
          <span className="eyebrow">IDENTITY</span>
          <h2>Profile &amp; security</h2>
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
          <p>
            These details identify you across every organization. Business and outlet information is
            managed in its own settings area.
          </p>
          <Link className="action" href="/account/security">
            Password, MFA &amp; active sessions →
          </Link>
        </section>
        <section className="panel stack">
          <span className="eyebrow">DEFAULT WORKSPACE</span>
          <h2>Where you start</h2>
          <p>
            Choose the organization or outlet MenuMinute opens first. This preference never grants
            access. You currently have {organizations.length} organization
            {organizations.length === 1 ? "" : "s"} and {outlets.length} active outlet
            {outlets.length === 1 ? "" : "s"}.
          </p>
          <AccountWorkspacePreference
            organizations={organizations
              .filter((o) => o.isActive)
              .map((o) => ({ id: o.id, name: o.name, role: o.role }))}
            outlets={outlets.map((o) => ({
              id: o.id,
              name: o.name,
              organizationId: o.organizationId,
            }))}
            selectedOrganizationId={preference?.organizationId ?? null}
            selectedOutletId={preference?.outletId ?? null}
          />
        </section>
      </div>
      <div className="columns">
        <section className="panel stack">
          <span className="eyebrow">DISPLAY &amp; DEVICES</span>
          <h2>Personal preferences</h2>
          <p>
            Theme and app-device choices apply to you, not to your restaurant&apos;s public menu.
          </p>
          <div className="row between">
            <span>Color theme</span>
            <ThemeControl />
          </div>
          <Link className="action" href="/dashboard/settings/device">
            Device &amp; installed app settings →
          </Link>
        </section>
        <section className="panel stack">
          <span className="eyebrow">PRIVACY &amp; ACCOUNT</span>
          <h2>Data and access</h2>
          <p>
            Review the{" "}
            <Link className="underline" href="/privacy">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link className="underline" href="/terms">
              Terms of Service
            </Link>
            , or open the{" "}
            <Link className="underline" href="/delete-account">
              account deletion process
            </Link>
            .
          </p>
          <AccountSignOutButton />
        </section>
      </div>
    </main>
  );
}
