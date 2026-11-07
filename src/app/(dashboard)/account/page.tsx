import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  LockKeyhole,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { listOrganizations } from "@/modules/organizations/service";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { SettingsScopeNav } from "@/components/settings/settings-scope-nav";
import { AccountSignOutButton } from "@/app/account/sign-out-button";
import { AccountWorkspacePreference } from "@/app/account/workspace-preference";
import { readWorkspacePreference } from "@/modules/organizations/workspace-preferences";
import "../dashboard/organization/organization.css";
import "./account.css";

export const metadata = {
  title: "My account | MenuMinute",
  description: "Personal identity, security and workspace preferences.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login?next=%2Faccount");

  const [organizations, outlets, preference] = await Promise.all([
    listOrganizations({ userId: session.user.id }),
    getRestaurantsByUserId(session.user.id),
    readWorkspacePreference(session.user.id),
  ]);
  const activeOrganizations = organizations.filter((organization) => organization.isActive);

  return (
    <div className="mm-organization mm-account" data-testid="account-workspace">
      <header className="oh-hero mm-account-hero">
        <div className="oh-hero-copy">
          <span className="oh-kicker">MY ACCOUNT / PERSONAL SETTINGS</span>
          <h2 className="oh-hero-meta">Identity and security</h2>
          <h1>
            <span className="mm-hero-line">Everything personal,</span>{" "}
            <span className="mm-hero-line">in one place.</span>
          </h1>
          <p>
            Your identity, sign-in protection and preferred workspace—kept separate from restaurant
            and organization settings.
          </p>
          <div className="oh-hero-buttons">
            <Link href="/account/security" className="oh-primary">
              Review account security →
            </Link>
            <a className="oh-secondary" href="#workspace">
              Choose default workspace ↘
            </a>
          </div>
        </div>
      </header>

      <div className="oh-scope-nav">
        <SettingsScopeNav />
      </div>

      <div className="oh-body">
        <section className="oh-pulse" aria-label="Account overview">
          <div>
            <span>IDENTITY</span>
            <strong>{session.user.emailVerified ? "Verified" : "Action needed"}</strong>
            <small>{session.user.email}</small>
          </div>
          <div>
            <span>ORGANIZATIONS</span>
            <strong>{activeOrganizations.length}</strong>
            <small>Active memberships</small>
          </div>
          <div>
            <span>OUTLETS</span>
            <strong>{outlets.length}</strong>
            <small>Available workspaces</small>
          </div>
          <div>
            <span>SECURITY</span>
            <strong>MFA &amp; sessions</strong>
            <small>Managed in Account security</small>
          </div>
        </section>

        <div className="oh-layout">
          <nav className="oh-nav" aria-label="Account sections">
            <span className="oh-kicker">ACCOUNT AREAS</span>
            <a href="#profile">
              <UserRound size={17} aria-hidden="true" /> <span>Profile</span>
            </a>
            <a href="#security">
              <ShieldCheck size={17} aria-hidden="true" /> <span>Security</span>
            </a>
            <a href="#workspace">
              <Building2 size={17} aria-hidden="true" /> <span>Default workspace</span>
            </a>
            <a href="#preferences">
              <Palette size={17} aria-hidden="true" /> <span>Preferences</span>
            </a>
            <a href="#privacy">
              <LockKeyhole size={17} aria-hidden="true" /> <span>Privacy &amp; access</span>
            </a>
            <p>
              Personal settings follow you across organizations. Outlet and business controls stay
              in their own guarded workspaces.
            </p>
          </nav>

          <div className="oh-sections">
            <section id="profile" className="oh-panel" aria-labelledby="account-profile-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">01 / YOUR IDENTITY</span>
                  <h2 id="account-profile-title">The person behind the workspace.</h2>
                  <p>Verified account details used across every organization you can access.</p>
                </div>
                <div aria-hidden="true" className="oh-art oh-art-owners-office" />
              </header>
              <div className="oh-panel-content">
                <dl className="account-detail-grid">
                  <div>
                    <dt>Full name</dt>
                    <dd>{session.user.name || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt>Email address</dt>
                    <dd>{session.user.email}</dd>
                  </div>
                  <div>
                    <dt>Email status</dt>
                    <dd className={session.user.emailVerified ? "is-verified" : "is-warning"}>
                      <CheckCircle2 size={17} aria-hidden="true" />
                      {session.user.emailVerified ? "Verified" : "Verification required"}
                    </dd>
                  </div>
                </dl>
                <p className="oh-hint">
                  Identity corrections and verified-email changes require a protected recovery
                  workflow; they are not mixed with restaurant profile fields.
                </p>
              </div>
            </section>

            <section id="security" className="oh-panel" aria-labelledby="account-security-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">02 / SIGN-IN PROTECTION</span>
                  <h2 id="account-security-title">Security without guesswork.</h2>
                  <p>Review your password, MFA enrollment and every active signed-in device.</p>
                </div>
                <div aria-hidden="true" className="oh-art oh-art-capabilities" />
              </header>
              <div className="oh-panel-content">
                <div className="account-action-card">
                  <span className="account-action-icon">
                    <ShieldCheck size={24} aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Account security &amp; sessions</strong>
                    <p>Manage password protection, authenticator setup and signed-in devices.</p>
                  </div>
                  <Link href="/account/security" className="oh-primary">
                    Open security console →
                  </Link>
                </div>
              </div>
            </section>

            <section id="workspace" className="oh-panel" aria-labelledby="account-workspace-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">03 / WHERE YOU START</span>
                  <h2 id="account-workspace-title">Your default workspace.</h2>
                  <p>Choose where MenuMinute opens first. This preference never grants access.</p>
                </div>
                <div aria-hidden="true" className="oh-art oh-art-outlet-collection" />
              </header>
              <div className="oh-panel-content">
                <AccountWorkspacePreference
                  organizations={activeOrganizations.map((organization) => ({
                    id: organization.id,
                    name: organization.name,
                    role: organization.role,
                  }))}
                  outlets={outlets.map((outlet) => ({
                    id: outlet.id,
                    name: outlet.name,
                    organizationId: outlet.organizationId,
                  }))}
                  selectedOrganizationId={preference?.organizationId ?? null}
                  selectedOutletId={preference?.outletId ?? null}
                />
              </div>
            </section>

            <section
              id="preferences"
              className="oh-panel"
              aria-labelledby="account-preferences-title"
            >
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">04 / YOUR EXPERIENCE</span>
                  <h2 id="account-preferences-title">Display &amp; device preferences.</h2>
                  <p>Personal interface choices that do not change the public restaurant menu.</p>
                </div>
                <div aria-hidden="true" className="oh-art oh-art-brand-gallery" />
              </header>
              <div className="oh-panel-content account-preference-grid">
                <div className="account-preference-card">
                  <Palette size={22} aria-hidden="true" />
                  <div>
                    <strong>Color theme</strong>
                    <p>Switch between light and dark workspace themes.</p>
                  </div>
                  <ThemeControl />
                </div>
                <Link className="account-preference-card" href="/dashboard/settings/device">
                  <MonitorSmartphone size={22} aria-hidden="true" />
                  <div>
                    <strong>Device &amp; installed app</strong>
                    <p>Review device-specific and PWA preferences.</p>
                  </div>
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            </section>

            <section id="privacy" className="oh-panel" aria-labelledby="account-privacy-title">
              <header className="oh-panel-heading">
                <div>
                  <span className="oh-kicker">05 / PRIVACY &amp; ACCESS</span>
                  <h2 id="account-privacy-title">Your data, clearly handled.</h2>
                  <p>Policies, deletion information and the controls for ending this session.</p>
                </div>
                <div aria-hidden="true" className="oh-art oh-art-activity" />
              </header>
              <div className="oh-panel-content">
                <div className="account-policy-grid">
                  <Link href="/privacy">
                    <LockKeyhole size={20} aria-hidden="true" />
                    <strong>Privacy Policy</strong>
                    <small>How MenuMinute handles personal and business data</small>
                  </Link>
                  <Link href="/terms">
                    <Building2 size={20} aria-hidden="true" />
                    <strong>Terms of Service</strong>
                    <small>The agreement governing your use of MenuMinute</small>
                  </Link>
                  <Link href="/delete-account">
                    <UserRound size={20} aria-hidden="true" />
                    <strong>Account deletion</strong>
                    <small>Review the protected deletion-request process</small>
                  </Link>
                </div>
                <div className="account-signout">
                  <div>
                    <strong>End this session</strong>
                    <p>Sign out safely from this browser without affecting other team members.</p>
                  </div>
                  <AccountSignOutButton />
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
