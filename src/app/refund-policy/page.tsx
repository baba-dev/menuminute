import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Download,
  FileCheck2,
  Mail,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "../privacy/privacy.css";
import "./refund-policy.css";

const PAGE_URL = "https://food.bababuilds.com/refund-policy";
const DESCRIPTION =
  "Read MenuMinute's refund and cancellation policy for paid restaurant software plans. No voluntary refunds, with statutory protections and billing-error remedies preserved.";
const EFFECTIVE_DATE = "2 November 2026";
const SUPPORT_EMAIL =
  "mailto:admin@bababuilds.com?subject=MenuMinute%20Billing%20or%20Refund%20Request";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy — MenuMinute Subscriptions",
  description: DESCRIPTION,
  keywords: [
    "MenuMinute refund policy",
    "MenuMinute subscription cancellation",
    "MenuMinute SaaS no refund policy",
    "MenuMinute billing dispute",
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Refund & Cancellation Policy | MenuMinute by BabaBuilds",
    description: DESCRIPTION,
    url: PAGE_URL,
    siteName: "MenuMinute",
    type: "website",
    locale: "en_IN",
    images: [
      {
        url: "/brand/social/og-light.webp",
        width: 1200,
        height: 630,
        alt: "MenuMinute by BabaBuilds",
      },
    ],
  },
  twitter: {
    title: "Refund & Cancellation Policy | MenuMinute by BabaBuilds",
    description: DESCRIPTION,
    card: "summary_large_image",
    images: ["/brand/social/og-light.webp"],
  },
};

const contents = [
  { id: "scope", label: "1. Who and what this policy covers" },
  { id: "standard", label: "2. Our no-voluntary-refund policy" },
  { id: "exceptions", label: "3. When a refund or remedy may be due" },
  { id: "cancellation", label: "4. Cancellation and renewals" },
  { id: "payments", label: "5. Failed, duplicate and disputed payments" },
  { id: "process", label: "6. How to request a review" },
  { id: "resolution", label: "7. Resolution and payment timing" },
  { id: "diners", label: "8. Restaurant orders are separate" },
  { id: "rights", label: "9. Indian law, other rights and contact" },
];

const highlights = [
  {
    number: "01",
    title: "Fair, low-cost pricing",
    detail: "No change-of-mind or unused-time refunds.",
  },
  {
    number: "02",
    title: "Cancel future renewals",
    detail: "Keep eligible access through the paid period.",
  },
  {
    number: "03",
    title: "Rights remain protected",
    detail: "Billing mistakes and legally required remedies are reviewed.",
  },
];

function RefundArtwork() {
  return (
    <svg
      className="privacy-artwork refund-artwork"
      viewBox="0 0 480 430"
      role="img"
      aria-labelledby="refund-art-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="refund-art-title">
        An illustrated subscription receipt protected by a warm gold shield and a checkmark
      </title>
      <defs>
        <linearGradient id="refund-sheet" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffe8b6" />
          <stop offset="100%" stopColor="#eaa45e" />
        </linearGradient>
        <radialGradient id="refund-glow">
          <stop stopColor="#f0a767" stopOpacity=".4" />
          <stop offset="100%" stopColor="#f0a767" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="214" r="195" fill="url(#refund-glow)" />
      <circle
        className="privacy-art-orbit"
        cx="240"
        cy="214"
        r="171"
        fill="none"
        stroke="#e7a65c"
        strokeOpacity=".54"
        strokeDasharray="3 9"
        strokeWidth="1.5"
      />
      <circle cx="240" cy="214" r="141" fill="none" stroke="#e7a65c" strokeOpacity=".3" />
      <g className="privacy-art-nodes" fill="#ffbd79">
        <circle cx="240" cy="43" r="5" />
        <circle cx="411" cy="214" r="5" />
        <circle cx="240" cy="385" r="5" />
        <circle cx="69" cy="214" r="5" />
      </g>
      <ellipse cx="240" cy="348" rx="129" ry="17" fill="#090504" opacity=".27" />
      <rect x="140" y="82" width="202" height="273" rx="22" fill="#110c09" stroke="#d49a5c" strokeWidth="2.5" />
      <path
        d="M154 99h174v235l-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8-13 8-13-8V99z"
        fill="url(#refund-sheet)"
      />
      <path d="M181 130h77" stroke="#764522" strokeWidth="6" strokeLinecap="round" />
      <path d="M181 151h120" stroke="#9c683c" strokeWidth="3" strokeLinecap="round" opacity=".7" />
      <path d="M181 185h108M181 201h94M181 217h111" stroke="#a87345" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      <path d="M181 256h118" stroke="#c58b55" strokeWidth="2" strokeDasharray="5 6" />
      <path d="M181 275h53" stroke="#804a29" strokeWidth="6" strokeLinecap="round" />
      <path d="M281 275h21" stroke="#804a29" strokeWidth="6" strokeLinecap="round" />
      <g className="privacy-art-nodes">
        <circle cx="332" cy="271" r="52" fill="#211711" stroke="#f2bb7d" strokeWidth="3" />
        <path d="m332 237 29 13v22c0 23-13 39-29 47-16-8-29-24-29-47v-22z" fill="#ca7836" stroke="#ffe0aa" strokeWidth="2" />
        <path d="m319 271 10 10 19-22" fill="none" stroke="#fff2db" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="124" cy="206" r="23" fill="#281b13" stroke="#e6a967" strokeWidth="2" />
      <path d="M114 207h20m-7-7 7 7-7 7" stroke="#f3bf85" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function RefundPolicyPage() {
  return (
    <div className="privacy-page refund-page">
      <a className="privacy-skip" href="#refund-content">
        Skip to Refund Policy
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
          <nav className="privacy-header-actions" aria-label="Refund Policy navigation">
            <Link href="/pricing" className="privacy-back">
              <ArrowLeft size={16} aria-hidden="true" /> Pricing
            </Link>
            <ThemeControl />
          </nav>
        </header>

        <section className="privacy-hero" aria-labelledby="refund-title">
          <div className="privacy-hero-copy">
            <span className="privacy-eyebrow">
              <span className="privacy-spark" /> 05 / THE BILLING LEDGER
            </span>
            <h1 id="refund-title">
              Clear prices. <em>Clear policies.</em>
            </h1>
            <p>
              Our straightforward approach to subscription refunds and cancellations—designed
              for affordable restaurant software, with your legal rights preserved.
            </p>
            <p className="privacy-review-status">
              No voluntary refunds for change of mind or unused time. Statutory rights and
              genuine billing errors are not excluded.
            </p>
            <div className="privacy-hero-meta">
              <span>Effective: {EFFECTIVE_DATE}</span>
              <span>Operator: BabaBuilds · India</span>
            </div>
          </div>
          <RefundArtwork />
        </section>

        <section className="privacy-principles" aria-label="Refund and cancellation essentials">
          {highlights.map((item) => (
            <div key={item.number}>
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>

        <div className="privacy-document" id="refund-content">
          <aside className="privacy-aside">
            <nav aria-label="Refund Policy contents">
              <p className="privacy-aside-label">ON THIS PAGE</p>
              <ol>
                {contents.map(({ id, label }) => (
                  <li key={id}>
                    <a href={"#" + id}>{label}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <a className="privacy-aside-contact" href={SUPPORT_EMAIL}>
              <Mail size={17} aria-hidden="true" /> Billing questions
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </aside>

          <main className="privacy-copy" aria-label="Refund and Cancellation Policy">
            <div className="privacy-note">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>The short version</strong>
                <p>
                  MenuMinute does not offer discretionary refunds on paid software subscriptions.
                  You can cancel an eligible recurring plan to prevent future renewals. If
                  a charge is incorrect or the promised service is materially deficient,
                  your rights under applicable law remain unaffected.
                </p>
              </div>
            </div>

            <details className="privacy-mobile-index">
              <summary>Jump to a section</summary>
              <ol>
                {contents.map(({ id, label }) => (
                  <li key={id}>
                    <a href={"#" + id}>{label}</a>
                  </li>
                ))}
              </ol>
            </details>

            <section className="privacy-section" id="scope" aria-labelledby="scope-heading">
              <h2 id="scope-heading">1. Who and what this policy covers</h2>
              <p>
                MenuMinute is software operated by <strong>BabaBuilds</strong>, a sole proprietorship
                based in Pilani, Rajasthan, India. This policy applies to fees that BabaBuilds
                itself charges a restaurant or authorized account owner for a MenuMinute
                platform subscription or separately purchased software service.
              </p>
              <p>
                Our permanent digital QR menu offering is free, so no refund arises merely
                from using it. Optional paid plans such as Live Table Ordering and Kitchen Pro
                are subject to the actual availability, eligibility, pricing and activation
                disclosed at <Link href="/pricing">pricing</Link> and checkout. Listing a plan,
                signing up or viewing a demonstration does not itself create a charge or
                guarantee that a restricted feature can be purchased immediately.
              </p>
              <p>
                This policy supplements our <Link href="/terms">Terms of Service</Link> and
                the terms shown before a payment is authorized. If a separately agreed written
                contract or applicable platform-store rules govern a particular purchase, they
                apply to their relevant scope, without taking away non-waivable legal rights.
              </p>
            </section>

            <section className="privacy-section" id="standard" aria-labelledby="standard-heading">
              <h2 id="standard-heading">2. Our no-voluntary-refund policy</h2>
              <p>
                <strong>Except where required by applicable law or expressly agreed in writing,
                completed charges for an activated paid subscription are non-refundable.</strong>
                This helps us keep the standard software plans affordable.
              </p>
              <p>In particular, we do not ordinarily refund an already-paid period because:</p>
              <ul>
                <li>You change your mind after purchase or decide the software is no longer needed.</li>
                <li>You do not use some or all of the subscription period or available features.</li>
                <li>You voluntarily cancel, close an account, or switch to the free plan before the paid period ends.</li>
                <li>You expected a benefit, feature or business outcome that was not included in the agreed plan description.</li>
              </ul>
              <p>
                We do not promise an automatic trial, cooling-off period, credit balance,
                pro-rata refund or transferable subscription value. Any promotion or
                exceptional commercial goodwill remedy must be expressly confirmed by
                BabaBuilds; it does not create a standing refund entitlement.
              </p>
            </section>

            <section className="privacy-section" id="exceptions" aria-labelledby="exceptions-heading">
              <h2 id="exceptions-heading">3. When a refund or remedy may be due</h2>
              <p>
                The no-voluntary-refund rule <strong>does not override applicable consumer
                protection law, payment rules or other mandatory rights</strong>. We review
                issues including:
              </p>
              <ul>
                <li>A charge taken for a subscription we did not provide or could not activate as agreed.</li>
                <li>A material deficiency or misrepresentation of the purchased service that we cannot appropriately remedy.</li>
                <li>Duplicate, incorrect, excessive or otherwise unauthorized billing.</li>
                <li>A transaction failure requiring a reversal, or another refund or remedy required by law, contract or a binding authority.</li>
              </ul>
              <p>
                Depending on the facts and your applicable legal rights, the resolution
                may include fixing the service, providing it as agreed, correcting a charge,
                extending access where appropriate, or a full or proportionate refund.
                We will not insist on store credit in place of a monetary refund when
                the law requires repayment. We assess each report fairly, not solely
                by whether a plan is inexpensive.
              </p>
            </section>

            <section className="privacy-section" id="cancellation" aria-labelledby="cancellation-heading">
              <h2 id="cancellation-heading">4. Cancellation and renewals</h2>
              <p>
                When recurring billing is enabled for your plan, the authorized organization
                owner can request cancellation through the available billing controls or
                by contacting us at <a href={SUPPORT_EMAIL}>admin@bababuilds.com</a>.
                Subject to any legally required exception or different term disclosed at
                purchase, cancellation takes effect at the <strong>end of the
                already-paid billing period</strong>. It stops future renewals and
                ordinarily preserves eligible paid access until that period ends.
              </p>
              <p>
                A cancellation is not the same as a refund of past charges. Removing an
                installed web app or discontinuing use does not by itself cancel a
                recurring subscription. Please check that the cancellation was
                acknowledged and contact us promptly if a renewal appears after an
                effective cancellation.
              </p>
              <p>
                Any automatic renewal, price, frequency, taxes and cancellation terms
                must be disclosed before payment authorization; renewal payments are
                subject to applicable payment-network and RBI requirements where relevant.
                If a paid plan is not currently enabled for your account, no new
                subscription charge is authorized merely by reading this policy.
              </p>
            </section>

            <section className="privacy-section" id="payments" aria-labelledby="payments-heading">
              <h2 id="payments-heading">5. Failed, duplicate and disputed payments</h2>
              <p>
                If your bank or payment app shows a debit but your MenuMinute subscription
                was not activated, do not pay repeatedly without checking the first
                transaction. Send us the transaction reference so we can review our
                records and coordinate with the payment provider as appropriate.
              </p>
              <p>
                Failed-payment reversals, chargebacks and other payment-network
                remedies follow applicable banking, card, UPI or payment-service
                rules, including RBI requirements where applicable. We will not
                use this no-voluntary-refund policy to deny a reversal or correction
                legally required after an unsuccessful or duplicate payment.
                For an unrecognized charge, you may also contact your bank or
                payment provider promptly.
              </p>
            </section>

            <section className="privacy-section" id="process" aria-labelledby="process-heading">
              <h2 id="process-heading">6. How to request a billing review</h2>
              <div className="refund-steps">
                <div>
                  <span>01</span>
                  <div>
                    <strong>Send an email</strong>
                    <p>
                      Write to <a href={SUPPORT_EMAIL}>admin@bababuilds.com</a> with
                      the subject &ldquo;MenuMinute Billing or Refund Request&rdquo;.
                    </p>
                  </div>
                </div>
                <div>
                  <span>02</span>
                  <div>
                    <strong>Include the essentials</strong>
                    <p>
                      Share your account email, organization or outlet name,
                      approximate date, amount, invoice or provider transaction reference,
                      and a short description of the problem. Do not send a full card
                      number, password, one-time password or sensitive banking credentials.
                    </p>
                  </div>
                </div>
                <div>
                  <span>03</span>
                  <div>
                    <strong>We investigate and respond</strong>
                    <p>
                      We may verify your authority to act for the business, review payment
                      and service records, ask for relevant evidence, and explain the
                      proposed remedy or reason for our decision.
                    </p>
                  </div>
                </div>
              </div>
              <p>
                Contact us as soon as you notice an issue. No informal support
                deadline on this page shortens a claim period or remedy that
                applicable law gives you.
              </p>
            </section>

            <section className="privacy-section" id="resolution" aria-labelledby="resolution-heading">
              <h2 id="resolution-heading">7. Resolution and payment timing</h2>
              <p>
                Where a monetary refund is due, we will process it through an appropriate
                original payment method or another lawful and verified method, subject
                to payment-provider capabilities and applicable rules. Bank or
                provider settlement time may vary. We will communicate the relevant
                status or next steps rather than promise an unverified universal
                &ldquo;instant refund&rdquo; period.
              </p>
              <p>
                Legally prescribed reversal, refund, grievance and compensation
                deadlines take precedence over any operational estimate. Applicable
                invoice, GST or credit-note adjustments will be handled as required
                for the particular transaction.
              </p>
            </section>

            <section className="privacy-section" id="diners" aria-labelledby="diners-heading">
              <h2 id="diners-heading">8. Restaurant orders are separate</h2>
              <p>
                This is a policy for <strong>MenuMinute platform software fees</strong>,
                not for food or restaurant-service purchases made by diners. A restaurant
                sets its menu prices, fulfils diner orders and is ordinarily responsible
                for the associated food-order cancellations, refunds and disputes.
                Guests should contact the restaurant that sold the order.
              </p>
              <p>
                A restaurant cannot use this software-subscription policy to deny
                diners rights they may have against it. Nothing here removes a
                responsibility that applicable law separately places on BabaBuilds.
              </p>
            </section>

            <section className="privacy-section" id="rights" aria-labelledby="rights-heading">
              <h2 id="rights-heading">9. Indian law, other rights and contact</h2>
              <p>
                This policy is designed to operate subject to Indian law, including
                the <strong>Consumer Protection Act, 2019</strong> and applicable
                <strong> Consumer Protection (E-Commerce) Rules</strong>, as well as
                relevant payment-system requirements. Those laws can protect
                eligible customers against unfair terms, deficient services and
                unlawful refusal of required remedies. The precise rights depend on
                the transaction and whether the purchaser qualifies for a particular
                legal protection.
              </p>
              <p>
                A limitation here applies only to the extent allowed by applicable
                law. No clause prevents an eligible person from contacting a
                regulator, payment provider, consumer commission or other competent
                authority or from exercising non-excludable rights. You can find
                Indian consumer-protection information at the{" "}
                <a
                  href="https://consumerhelpline.gov.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  National Consumer Helpline
                  <ArrowUpRight size={14} aria-hidden="true" className="inline" />
                </a>.
              </p>
              <p>
                Operator: BabaBuilds (sole proprietorship), Pilani, Rajasthan,
                India. Billing and policy contact:{" "}
                <a href={SUPPORT_EMAIL}>admin@bababuilds.com</a>. Our{" "}
                <Link href="/terms">Terms of Service</Link> and{" "}
                <Link href="/privacy">Privacy Policy</Link> explain related
                contractual and data-handling matters. We may update this
                policy prospectively with appropriate notice; a later update
                does not remove rights or alter already-agreed charges
                contrary to applicable law.
              </p>
            </section>

            <div className="privacy-last">
              <div>
                <span>QUESTIONS ABOUT A CHARGE?</span>
                <h2>Talk to a real person.</h2>
                <p>
                  Share your billing reference and we will review the matter
                  against your plan, payment details and applicable rights.
                </p>
              </div>
              <a href={SUPPORT_EMAIL}>
                <Mail size={18} aria-hidden="true" /> Contact billing support
              </a>
            </div>

            <p className="refund-related">
              <ReceiptText size={16} aria-hidden="true" />
              <Link href="/pricing">View plans</Link>
              <span aria-hidden="true">·</span>
              <Link href="/terms">Read Terms</Link>
              <span aria-hidden="true">·</span>
              <Link href="/contact">Contact us</Link>
            </p>
            <p className="privacy-print-hint">
              <Download size={14} aria-hidden="true" />
              Print or save this policy for your records.
            </p>
            <p className="refund-version">
              <FileCheck2 size={14} aria-hidden="true" /> Effective {EFFECTIVE_DATE}.
              <RefreshCcw size={14} aria-hidden="true" /> Cancellation concerns
              future renewals; it is not a retroactive refund.
            </p>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
