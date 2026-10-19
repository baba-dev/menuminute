import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Mail, ShieldCheck, UserRoundX } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "../privacy/privacy.css";

export const metadata: Metadata = {
  title: "Account deletion requests — Review draft",
  description: "Information about requesting deletion of a MenuMinute account and associated data.",
  robots: { index: false, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <div className="privacy-page">
      <a className="privacy-skip" href="#deletion-information">
        Skip to account-deletion information
      </a>
      <div className="privacy-shell">
        <header className="privacy-header">
          <Link href="/" aria-label="MenuMinute homepage" className="privacy-brand">
            <Image
              src="/brand/logos/logo-horizontal-light.svg"
              alt="MenuMinute"
              width={205}
              height={48}
              unoptimized
              className="privacy-logo-light"
            />
            <Image
              src="/brand/logos/logo-horizontal-dark.svg"
              alt=""
              width={205}
              height={48}
              unoptimized
              className="privacy-logo-dark"
            />
          </Link>
          <nav className="privacy-header-actions" aria-label="Site navigation">
            <Link href="/privacy" className="privacy-back">
              <ArrowLeft size={16} aria-hidden="true" /> Privacy
            </Link>
            <ThemeControl />
          </nav>
        </header>
        <div
          className="privacy-document"
          id="deletion-information"
          style={{ maxWidth: 920, margin: "0 auto", display: "block" }}
        >
          <div className="privacy-note">
            <UserRoundX aria-hidden="true" size={24} />
            <div>
              <strong>Account deletion — implementation and legal review in progress</strong>
              <p>
                This page currently provides a contact-based privacy request channel; it is not a
                finished automated in-app deletion feature. Do not submit a native application for
                store approval until the in-app deletion flow, associated-data cleanup and verified
                retention exceptions are implemented and tested.
              </p>
            </div>
          </div>
          <main className="privacy-copy">
            <section className="privacy-section">
              <p className="privacy-eyebrow">MENU MINUTE / PRIVACY CHOICES</p>
              <h1
                style={{
                  fontFamily: "var(--font-display), sans-serif",
                  fontSize: "clamp(2.3rem, 6vw, 4rem)",
                  fontWeight: 900,
                  letterSpacing: "-.05em",
                  margin: "1.2rem 0",
                }}
              >
                Request account and data deletion.
              </h1>
              <p>
                MenuMinute is operated by BabaBuilds, a sole proprietorship based in Pilani,
                Rajasthan, India. For now, to begin a privacy-related deletion enquiry please
                contact us using the email address below and include the email associated with your
                account. Do not send a password, authentication code or sensitive identity document
                in the initial message.
              </p>
              <a
                className="privacy-aside-contact"
                style={{
                  display: "inline-flex",
                  padding: "1rem 1.25rem",
                  background: "var(--p-soft)",
                  borderRadius: 12,
                }}
                href="mailto:admin@bababuilds.com?subject=MenuMinute%20Account%20Deletion%20Request"
              >
                <Mail size={18} aria-hidden="true" /> Email admin@bababuilds.com
              </a>
            </section>
            <section className="privacy-section">
              <h2>What your request means</h2>
              <p>
                Specify whether you want to delete your individual account, seek removal of certain
                information, or ask about deleting an entire restaurant organization. We may need to
                verify account ownership and confirm the impact on other authorized users before
                proceeding. Restaurant guest data may also be controlled by the restaurant to which
                an order was submitted.
              </p>
              <p>
                Account deletion is intended to remove the account and associated personal data,
                subject only to information that must be retained for applicable legal, security,
                dispute or financial-record purposes. Merely disabling an account is not equivalent
                to deletion. Record-by-record retention periods, production deletion automation and
                backup expiry must be approved and verified before this becomes a store-launch
                capability.
              </p>
            </section>
            <section className="privacy-section">
              <h2>Other privacy choices</h2>
              <p>
                Use the same email to ask for access, correction, an available export, marketing
                preferences or information about the data we hold. Review the{" "}
                <Link href="/privacy">Privacy Policy</Link> for the full proposed scope of
                data categories and rights.
              </p>
              <p>
                Do not assume that emailing this address immediately and automatically removes a
                live account. Our team must verify and complete the request under the applicable
                procedure and law.
              </p>
            </section>
            <div className="privacy-note">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>Mobile store release gate</strong>
                <p>
                  Google Play requires a discoverable in-app and external deletion route; Apple
                  requires users to initiate deletion inside the app. A mailto link alone is not an
                  adequate replacement for those paths.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
