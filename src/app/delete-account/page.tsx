import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Download,
  FileCheck2,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "../privacy/privacy.css";
import "./delete-account.css";

const PAGE_URL = "https://food.bababuilds.com/delete-account";
const DESCRIPTION =
  "Request deletion of your MenuMinute account and associated personal data. Learn how to submit a verified request, what may be deleted and what must be retained.";

const DELETE_EMAIL =
  "mailto:admin@bababuilds.com?subject=MenuMinute%20Account%20Deletion%20Request&body=Hello%20MenuMinute%20privacy%20team%2C%0A%0AI%20would%20like%20to%20request%20deletion%20of%20my%20MenuMinute%20account%20and%20associated%20personal%20data.%0A%0AAccount%20email%3A%20%0AType%20of%20request%3A%20Individual%20account%20%2F%20restaurant%20organization%20%2F%20specific%20data%0A%0AThank%20you.";

export const metadata: Metadata = {
  title: "Delete Your MenuMinute Account & Data",
  description: DESCRIPTION,
  keywords: [
    "delete MenuMinute account",
    "MenuMinute account deletion",
    "MenuMinute data deletion request",
    "remove MenuMinute account",
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Delete Your MenuMinute Account & Data | MenuMinute",
    description: DESCRIPTION,
    url: PAGE_URL,
    type: "website",
  },
  twitter: {
    title: "Delete Your MenuMinute Account & Data | MenuMinute",
    description: DESCRIPTION,
    card: "summary_large_image",
  },
};

const sections = [
  { id: "request", label: "01. How to request deletion" },
  { id: "process", label: "02. What happens next" },
  { id: "removed", label: "03. Data we remove" },
  { id: "retained", label: "04. Data we may retain" },
  { id: "organizations", label: "05. Restaurant and guest data" },
  { id: "more-choices", label: "06. More privacy choices" },
];

function DeleteArtwork() {
  return (
    <svg
      className="privacy-artwork delete-artwork"
      viewBox="0 0 480 430"
      role="img"
      aria-labelledby="delete-art-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="delete-art-title">
        A glowing personal-data card leaving a protected account vault, with a confirmation check
      </title>
      <defs>
        <linearGradient id="delete-card-grad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffe2ad" />
          <stop offset="100%" stopColor="#e8883b" />
        </linearGradient>
        <radialGradient id="delete-glow">
          <stop stopColor="#f6a85c" stopOpacity=".33" />
          <stop offset="100%" stopColor="#f6a85c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="214" r="195" fill="url(#delete-glow)" />
      <circle
        className="privacy-art-orbit"
        cx="240"
        cy="214"
        r="170"
        fill="none"
        stroke="#e7a65c"
        strokeWidth="1.5"
        strokeOpacity=".55"
        strokeDasharray="3 9"
      />
      <circle cx="240" cy="214" r="140" fill="none" stroke="#e7a65c" strokeOpacity=".3" />
      <g className="privacy-art-nodes" fill="#f6b978">
        <circle cx="240" cy="44" r="5" />
        <circle cx="410" cy="214" r="5" />
        <circle cx="240" cy="384" r="5" />
        <circle cx="70" cy="214" r="5" />
      </g>
      <ellipse cx="241" cy="348" rx="126" ry="17" fill="#050302" opacity=".3" />
      <rect x="115" y="97" width="249" height="233" rx="35" fill="#110d0a" stroke="#e7a66b" strokeWidth="3" />
      <rect x="129" y="111" width="221" height="205" rx="24" fill="#2b1c13" />
      <path
        d="M148 160h181M148 272h181"
        stroke="#b97d47"
        strokeOpacity=".45"
        strokeWidth="2"
      />
      <g transform="rotate(-8 243 200)">
        <rect x="174" y="133" width="143" height="139" rx="18" fill="url(#delete-card-grad)" />
        <circle cx="245" cy="176" r="22" fill="#75401e" />
        <path d="M209 233c2-25 23-34 36-34s35 9 36 34" fill="#75401e" />
        <path d="M198 249h95" stroke="#a05a2c" strokeWidth="4" strokeLinecap="round" />
      </g>
      <circle cx="323" cy="282" r="40" fill="#251a12" stroke="#ffd39b" strokeWidth="3" />
      <path
        d="m304 281 13 14 26-29"
        fill="none"
        stroke="#ffcf83"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M118 206h-28m4-9-9 9 9 9"
        fill="none"
        stroke="#f3b577"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M359 206h28m-4-9 9 9-9 9"
        fill="none"
        stroke="#f3b577"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const highlights = [
  { number: "01", title: "Make a request", detail: "Start from this public page, without signing in." },
  { number: "02", title: "Verify ownership", detail: "We confirm the request belongs to you." },
  { number: "03", title: "Review the result", detail: "We explain the outcome and any lawful retention." },
];

export default function DeleteAccountPage() {
  return (
    <div className="privacy-page delete-page">
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
          <nav className="privacy-header-actions" aria-label="Deletion page navigation">
            <Link href="/privacy" className="privacy-back">
              <ArrowLeft size={16} aria-hidden="true" /> Privacy
            </Link>
            <ThemeControl />
          </nav>
        </header>

        <section className="privacy-hero" aria-labelledby="delete-title">
          <div className="privacy-hero-copy">
            <span className="privacy-eyebrow">
              <span className="privacy-spark" /> 03 / YOUR PRIVACY CHOICES
            </span>
            <h1 id="delete-title">
              Delete your MenuMinute account. <em>On your terms.</em>
            </h1>
            <p>
              You can ask us to delete your account and associated personal data. Here&apos;s how to
              start, what happens afterwards, and what we may need to keep.
            </p>
            <div className="delete-hero-actions">
              <a href={DELETE_EMAIL} className="delete-primary-action">
                <Mail size={19} aria-hidden="true" />
                Request account deletion
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a href="#deletion-information" className="delete-secondary-action">
                Read how it works <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="privacy-review-status">
              Requests are handled after identity verification. This page does not offer instant or
              automated deletion.
            </p>
            <div className="privacy-hero-meta">
              <span>MenuMinute · BabaBuilds</span>
              <span>Pilani, Rajasthan, India</span>
              <span>Public request page</span>
            </div>
          </div>
          <DeleteArtwork />
        </section>

        <section className="privacy-principles" aria-label="Account deletion at a glance">
          {highlights.map((item) => (
            <div key={item.number}>
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>

        <div className="privacy-document" id="deletion-information">
          <aside className="privacy-aside">
            <nav aria-label="Account deletion contents">
              <p className="privacy-aside-label">ON THIS PAGE</p>
              <ol>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={"#" + section.id}>{section.label}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <Link className="privacy-aside-contact" href="/privacy">
              <ShieldCheck size={17} aria-hidden="true" /> Privacy Policy
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </aside>

          <main className="privacy-copy" aria-label="Account deletion information">
            <div className="privacy-note">
              <LockKeyhole size={22} aria-hidden="true" />
              <div>
                <strong>For everyone with a MenuMinute account</strong>
                <p>
                  This page is available without a login, including if you cannot access your
                  account. We will verify ownership before processing a deletion. You do not need to
                  send us your password, one-time codes, or identity documents in your first message.
                </p>
              </div>
            </div>

            <details className="privacy-mobile-index">
              <summary>Jump to a section</summary>
              <ol>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={"#" + section.id}>{section.label}</a>
                  </li>
                ))}
              </ol>
            </details>

            <section className="privacy-section" id="request" aria-labelledby="request-heading">
              <h2 id="request-heading">01. How to request account deletion</h2>
              <p>
                To begin, email <strong>admin@bababuilds.com</strong> from the address associated with
                your MenuMinute account whenever possible. Put <strong>MenuMinute Account Deletion
                Request</strong> in the subject line. If you no longer have access to that email
                address, tell us so we can discuss another way to verify the request.
              </p>
              <ol className="delete-step-list">
                <li>
                  <strong>Choose what to remove.</strong> Ask to delete your personal MenuMinute
                  account, particular information, or an entire restaurant organization.
                </li>
                <li>
                  <strong>Identify your account.</strong> Include your registered email address and,
                  for a restaurant-wide request, the restaurant or organization name. Do not include
                  passwords or payment details.
                </li>
                <li>
                  <strong>Send your request.</strong> We review it and may ask for reasonable
                  verification before proceeding.
                </li>
              </ol>
              <a className="delete-inline-cta" href={DELETE_EMAIL}>
                <Mail size={18} aria-hidden="true" /> Compose a deletion request
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <p>
                The link opens your email application with a suggested message. Sending it starts a
                manual request; opening the link alone does not submit or complete deletion.
              </p>
            </section>

            <section className="privacy-section" id="process" aria-labelledby="process-heading">
              <h2 id="process-heading">02. What happens after you ask?</h2>
              <p>
                We check that the request is authorized, assess any shared restaurant access and
                legal obligations, and communicate the outcome. We may need to clarify which data
                belongs to your personal account and which belongs to a restaurant or its guests.
                If we cannot complete part of the request, we will explain why.
              </p>
              <p>
                This is not an instant self-service deletion button. The completion time depends on
                the verified request, any applicable legal deadlines, and information that needs
                additional review. We will communicate the result rather than silently treating
                account deactivation as deletion.
              </p>
            </section>

            <section className="privacy-section" id="removed" aria-labelledby="removed-heading">
              <h2 id="removed-heading">03. What information can be deleted?</h2>
              <p>
                A verified account-deletion request is for the account itself and personal data
                associated with it, not merely a disabled login. Depending on the relationship and
                applicable obligations, this may include:
              </p>
              <ul>
                <li>Personal account and profile details, and sign-in access or sessions.</li>
                <li>Personal workspace preferences and membership information linked to the account.</li>
                <li>Personal content or uploaded files that are no longer required for a restaurant&apos;s legitimate operations or legal obligations.</li>
                <li>Other identifiable information where there is no continuing lawful need to retain it.</li>
              </ul>
              <p>
                Restaurant-owned menus, shared team records, and orders may require separate
                treatment. We will review the appropriate scope with the authorized requester.
              </p>
            </section>

            <section className="privacy-section" id="retained" aria-labelledby="retained-heading">
              <h2 id="retained-heading">04. What data may be kept, and for how long?</h2>
              <p>
                Some information may be retained when needed for applicable tax and accounting
                rules, financial records, fraud or security investigations, disputes, and other
                legal obligations. This may include limited order or transaction records and
                necessary audit evidence. We will not treat a legal exception as permission to keep
                all account information indefinitely.
              </p>
              <p>
                Backup copies may remain until they are replaced or securely removed through the
                normal backup lifecycle. Retention depends on the type of record and applicable law;
                we have not published an across-the-board number of days that applies to every data
                category. Ask us about the relevant retention criteria in your request, or read
                section 10 of the <Link href="/privacy#retention">Privacy Policy</Link>.
              </p>
            </section>

            <section className="privacy-section" id="organizations" aria-labelledby="organizations-heading">
              <h2 id="organizations-heading">05. Restaurant organizations and guest orders</h2>
              <p>
                If you own a restaurant workspace, we may need to confirm your authority, discuss
                other active team members, and address open business obligations before an
                organization-wide request can be completed. Deleting a team member&apos;s personal
                account does not automatically authorize deletion of records shared by the whole
                restaurant.
              </p>
              <p>
                If you are a diner who placed an order using a restaurant&apos;s QR menu, you may not
                have a MenuMinute account to delete. You can still contact us about personal data.
                The restaurant may independently control order information and may need to handle
                some of your request directly.
              </p>
            </section>

            <section className="privacy-section" id="more-choices" aria-labelledby="more-choices-heading">
              <h2 id="more-choices-heading">06. Your other privacy choices</h2>
              <p>
                You can also contact us about access, correction, available data export, marketing
                preferences, or removal of particular information. You do not have to request
                complete account closure to raise a privacy question.
              </p>
              <p>
                MenuMinute is operated by <strong>BabaBuilds</strong>, a sole proprietorship based in
                Pilani, Rajasthan, India. For further details about how personal information is
                handled, read our <Link href="/privacy">Privacy Policy</Link> and{" "}
                <Link href="/terms">Terms of Service</Link>.
              </p>
            </section>

            <div className="privacy-last">
              <div>
                <span>READY TO MAKE A REQUEST?</span>
                <h2>Your privacy choices are yours.</h2>
                <p>
                  Email our privacy contact to request deletion or ask for help. We will take
                  reasonable steps to verify ownership before taking action.
                </p>
              </div>
              <a href={DELETE_EMAIL}>
                <Mail size={18} aria-hidden="true" /> Request account deletion
              </a>
            </div>
            <p className="privacy-print-hint">
              <Download size={14} aria-hidden="true" /> You can print or save this page for your records.
            </p>
            <div className="delete-privacy-link">
              <FileCheck2 size={18} aria-hidden="true" />
              <span>
                Already signed in? Review your <Link href="/account#privacy">account privacy settings</Link>.
              </span>
            </div>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
