import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Download, Mail, ShieldCheck } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { policySections } from "@/content/privacy";
import "./privacy.css";

export const metadata: Metadata = {
  title: "Privacy Policy — Legal review draft",
  description:
    "Review draft of MenuMinute's privacy notice, including data use, AI, restaurant ordering and privacy requests.",
  alternates: { canonical: "https://food.bababuilds.com/privacy" },
  robots: { index: false, follow: true },
};

function PrivacyArtwork() {
  return (
    <svg
      className="privacy-artwork"
      viewBox="0 0 480 430"
      role="img"
      aria-labelledby="privacy-art-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="privacy-art-title">An illustrated shield protecting a restaurant QR tile and connected data points</title>
      <defs>
        <linearGradient id="privacy-shield" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffce78" />
          <stop offset="100%" stopColor="#da6b24" />
        </linearGradient>
        <radialGradient id="privacy-halo">
          <stop stopColor="#ed9654" stopOpacity=".32" />
          <stop offset="100%" stopColor="#ed9654" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="214" r="193" fill="url(#privacy-halo)" />
      <circle className="privacy-art-orbit" cx="240" cy="214" r="169" fill="none" stroke="#e7a65c" strokeOpacity=".5" strokeDasharray="3 9" strokeWidth="1.5" />
      <circle cx="240" cy="214" r="142" fill="none" stroke="#a66a39" strokeOpacity=".5" />
      <circle cx="240" cy="214" r="110" fill="none" stroke="#e7a65c" strokeOpacity=".33" />
      <g fill="#f3af66">
        <circle cx="240" cy="45" r="5" /><circle cx="409" cy="214" r="5" /><circle cx="240" cy="383" r="5" /><circle cx="71" cy="214" r="5" />
      </g>
      <g className="privacy-art-nodes" stroke="#d6a372" strokeWidth="1.5" fill="#251b14">
        <path d="M118 92 171 145 M362 92 309 145 M118 336 171 283 M362 336 309 283" />
        <rect x="89" y="64" width="58" height="58" rx="14" />
        <rect x="333" y="64" width="58" height="58" rx="14" />
        <rect x="89" y="307" width="58" height="58" rx="14" />
        <rect x="333" y="307" width="58" height="58" rx="14" />
      </g>
      <g fill="none" stroke="#f6bb75" strokeWidth="3" strokeLinecap="round">
        <path d="M103 81h10v10h-10zM121 81h10v10h-10zM103 99h10v10h-10zM126 104h5" />
        <path d="M353 85h19M353 94h19M353 103h12" />
        <path d="M105 335l8 8 18-19" />
        <path d="M348 330h29v18h-29zM356 330v-7a7 7 0 0 1 14 0v7" />
      </g>
      <path d="M240 104 327 139v77c0 62-35 100-87 126-52-26-87-64-87-126v-77z" fill="url(#privacy-shield)" />
      <path d="M240 120 312 149v67c0 51-28 85-72 109-44-24-72-58-72-109v-67z" fill="#201913" />
      <path d="m210 216 20 20 43-49" fill="none" stroke="#ffd393" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M219 160h42M219 169h42" stroke="#a96d40" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const highlights = [
  { number: "01", title: "Purpose first", detail: "Why particular information is needed." },
  { number: "02", title: "Clear choices", detail: "How to make a privacy request." },
  { number: "03", title: "Merchant-aware", detail: "How restaurant and platform roles differ." },
];

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <a className="privacy-skip" href="#policy-content">Skip to privacy policy</a>
      <div className="privacy-shell">
        <header className="privacy-header">
          <Link href="/" aria-label="MenuMinute homepage" className="privacy-brand">
            <Image src="/brand/logos/logo-horizontal-light.svg" alt="MenuMinute" width={205} height={48} unoptimized className="privacy-logo-light" />
            <Image src="/brand/logos/logo-horizontal-dark.svg" alt="" width={205} height={48} unoptimized className="privacy-logo-dark" />
          </Link>
          <nav className="privacy-header-actions" aria-label="Policy navigation">
            <Link href="/" className="privacy-back"><ArrowLeft size={16} aria-hidden="true" /> Home</Link>
            <ThemeControl />
          </nav>
        </header>
        <section className="privacy-hero" aria-labelledby="privacy-title">
          <div className="privacy-hero-copy">
            <span className="privacy-eyebrow"><span className="privacy-spark" /> 01 / THE PRIVACY LEDGER</span>
            <h1 id="privacy-title">Your trust matters <em>at every table.</em></h1>
            <p>Clear information about what MenuMinute handles, why it matters, and the choices available to you.</p>
            <p className="privacy-review-status" role="status">Legal and operational review draft — not yet an effective published policy.</p>
            <div className="privacy-hero-meta">
              <span>Draft prepared: 19 October 2026</span>
              <span>Operator: BabaBuilds · India</span>
            </div>
          </div>
          <PrivacyArtwork />
        </section>
        <section className="privacy-principles" aria-label="How this policy is organized">
          {highlights.map((item) => (
            <div key={item.number}>
              <span>{item.number}</span><h2>{item.title}</h2><p>{item.detail}</p>
            </div>
          ))}
        </section>
        <div className="privacy-document" id="policy-content">
          <aside className="privacy-aside">
            <nav aria-label="Privacy policy contents">
              <p className="privacy-aside-label">ON THIS PAGE</p>
              <ol>
                {policySections.map(({id,title}) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
              </ol>
            </nav>
            <a className="privacy-aside-contact" href="mailto:admin@bababuilds.com?subject=MenuMinute%20Privacy%20Request">
              <Mail size={17} aria-hidden="true" /> Privacy enquiries <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </aside>
          <main className="privacy-copy" aria-label="Privacy policy draft">
            <div className="privacy-note">
              <ShieldCheck size={22} aria-hidden="true" />
              <div><strong>Designed for transparency, pending release validation.</strong><p>This draft separates existing operations from planned functionality. Its retention and provider inventory are subject to operational and legal approval before it can be used for an app-store submission.</p></div>
            </div>
            <details className="privacy-mobile-index">
              <summary>Jump to a section</summary>
              <ol>{policySections.map(({id,title}) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
            </details>
            {policySections.map((section) => (
              <section className="privacy-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-heading`}>
                <h2 id={`${section.id}-heading`}>{section.title}</h2>
                {section.paragraphs.map((p) => <p key={p}>{p}</p>)}
                {section.points && <ul>{section.points.map(p => <li key={p}>{p}</li>)}</ul>}
                {section.id === "rights" && <p><Link href="/delete-account">View the account-deletion request information <ArrowUpRight size={15} aria-hidden="true" className="inline" /></Link></p>}
                {section.id === "contact" && <p><a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Privacy">Email admin@bababuilds.com <ArrowUpRight size={15} aria-hidden="true" className="inline" /></a></p>}
              </section>
            ))}
            <div className="privacy-last">
              <div><span>NEED HELP?</span><h2>Privacy is a conversation, too.</h2><p>Send a question, request access to your information or ask about deletion.</p></div>
              <a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Privacy%20Request"><Mail size={18} aria-hidden="true" /> Contact privacy support</a>
            </div>
            <p className="privacy-print-hint"><Download size={14} aria-hidden="true" /> Use your browser’s print command to save this draft for review.</p>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
