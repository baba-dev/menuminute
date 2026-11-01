import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpenCheck, Download, Mail, Scale } from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { termsSections } from "@/content/terms";
import { TERMS_EFFECTIVE_LABEL } from "@/content/legal";
import "../privacy/privacy.css";
import "./terms.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "MenuMinute terms for merchant accounts, QR menus, ordering, kitchen tools and related services.",
  alternates: { canonical: "https://food.bababuilds.com/terms" },
  robots: { index: true, follow: true },
};

function TermsArtwork() {
  return (
    <svg
      className="privacy-artwork terms-artwork"
      viewBox="0 0 480 430"
      role="img"
      aria-labelledby="terms-art-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="terms-art-title">
        A glowing contract sheet, balanced scales and a restaurant QR code on an ember-colored table
      </title>
      <defs>
        <linearGradient id="terms-paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffe2a7" />
          <stop offset="100%" stopColor="#cf7633" />
        </linearGradient>
        <radialGradient id="terms-glow">
          <stop stopColor="#eaa15d" stopOpacity=".37" />
          <stop offset="100%" stopColor="#eaa15d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="244" cy="210" r="197" fill="url(#terms-glow)" />
      <circle
        className="privacy-art-orbit"
        cx="240"
        cy="214"
        r="169"
        fill="none"
        stroke="#e7a65c"
        strokeOpacity=".5"
        strokeDasharray="3 9"
        strokeWidth="1.5"
      />
      <circle cx="240" cy="214" r="142" fill="none" stroke="#a66a39" strokeOpacity=".5" />
      <g className="privacy-art-nodes">
        <circle cx="72" cy="214" r="5" fill="#f9bb75" />
        <circle cx="408" cy="214" r="5" fill="#f9bb75" />
        <circle cx="240" cy="46" r="5" fill="#f9bb75" />
        <circle cx="240" cy="382" r="5" fill="#f9bb75" />
      </g>
      <ellipse cx="240" cy="341" rx="131" ry="18" fill="#080504" fillOpacity=".29" />
      <g transform="rotate(-5 242 205)">
        <rect
          x="155"
          y="88"
          width="179"
          height="237"
          rx="20"
          fill="#120d0a"
          stroke="#d99b59"
          strokeWidth="2.5"
        />
        <rect x="165" y="78" width="179" height="237" rx="20" fill="url(#terms-paper)" />
        <rect x="177" y="92" width="155" height="211" rx="12" fill="#f9e8c6" />
        <path
          d="M198 126h75M198 143h113M198 155h101M198 167h109"
          stroke="#85502d"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M198 187h91M198 199h105M198 211h97"
          stroke="#ba8755"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="194" y="231" width="52" height="52" rx="6" fill="#32241b" />
        <g stroke="#f4c88c" strokeWidth="4" fill="none">
          <path d="M203 241h13v13h-13zM224 241h13v13h-13zM203 261h13v13h-13z" />
          <path d="M224 261h4v4h-4zM234 271h4" />
        </g>
        <path
          d="m263 263 12 12 22-28"
          stroke="#854820"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>
      <g
        className="terms-scale"
        fill="none"
        stroke="#ffcc84"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M104 138v-54M80 93h48M88 100l-15 27M88 100l15 27M120 100l-15 27M120 100l15 27" />
        <path d="M64 127q9 21 24 0M120 127q9 21 24 0M90 140h28" />
      </g>
      <g stroke="#f2af72" strokeWidth="2" fill="#241a12">
        <path d="M355 271l14-19 14 19v23h-28z" />
        <path d="M362 271h14M364 280h10" />
      </g>
    </svg>
  );
}

const highlights = [
  {
    number: "01",
    title: "Clear boundaries",
    detail: "Software provider and restaurant responsibilities.",
  },
  {
    number: "02",
    title: "Merchant-minded",
    detail: "Fair rules for plans, publishing and operations.",
  },
  {
    number: "03",
    title: "Guest-first clarity",
    detail: "Understand ordering, acceptance and food sales.",
  },
];

export default function TermsPage() {
  return (
    <div className="privacy-page terms-page">
      <a className="privacy-skip" href="#terms-content">
        Skip to Terms of Service
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
          <nav className="privacy-header-actions" aria-label="Terms navigation">
            <Link href="/" className="privacy-back">
              <ArrowLeft size={16} aria-hidden="true" /> Home
            </Link>
            <ThemeControl />
          </nav>
        </header>
        <section className="privacy-hero" aria-labelledby="terms-title">
          <div className="privacy-hero-copy">
            <span className="privacy-eyebrow">
              <span className="privacy-spark" /> 02 / THE SHARED TABLE
            </span>
            <h1 id="terms-title">
              Good terms make <em>better partnerships.</em>
            </h1>
            <p>
              A clear understanding between restaurants, guests and the platform behind every menu.
            </p>
            <p className="privacy-review-status" role="status">
              Effective {TERMS_EFFECTIVE_LABEL}
            </p>
            <div className="privacy-hero-meta">
              <span>Effective: {TERMS_EFFECTIVE_LABEL}</span>
              <span>BabaBuilds · India</span>
            </div>
          </div>
          <TermsArtwork />
        </section>
        <section className="privacy-principles" aria-label="How these Terms are organized">
          {highlights.map((item) => (
            <div key={item.number}>
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>
        <div className="privacy-document" id="terms-content">
          <aside className="privacy-aside">
            <nav aria-label="Terms of Service contents">
              <p className="privacy-aside-label">ON THIS PAGE</p>
              <ol>
                {termsSections.map(({ id, title }) => (
                  <li key={id}>
                    <a href={`#${id}`}>{title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <Link className="privacy-aside-contact" href="/privacy">
              <BookOpenCheck size={17} aria-hidden="true" /> Privacy Policy{" "}
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </aside>
          <main className="privacy-copy" aria-label="Terms of Service">
            <div className="privacy-note">
              <Scale size={22} aria-hidden="true" />
              <div>
                <strong>Terms matched to the services currently offered.</strong>
                <p>
                  Planned or account-gated capabilities apply only when MenuMinute enables them for
                  the relevant outlet. Restaurant sales remain between the guest and restaurant.
                </p>
              </div>
            </div>
            <details className="privacy-mobile-index">
              <summary>Jump to a section</summary>
              <ol>
                {termsSections.map(({ id, title }) => (
                  <li key={id}>
                    <a href={`#${id}`}>{title}</a>
                  </li>
                ))}
              </ol>
            </details>
            {termsSections.map((section) => (
              <section
                className="privacy-section"
                id={section.id}
                key={section.id}
                aria-labelledby={`${section.id}-heading`}
              >
                <h2 id={`${section.id}-heading`}>{section.title}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {section.points && (
                  <ul>
                    {section.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                {section.id === "privacy" && (
                  <p>
                    <Link href="/privacy">
                      Read the companion Privacy Policy{" "}
                      <ArrowUpRight size={15} aria-hidden="true" className="inline" />
                    </Link>
                  </p>
                )}
                {section.id === "suspension" && (
                  <p>
                    <Link href="/delete-account">
                      View current account-deletion request information{" "}
                      <ArrowUpRight size={15} aria-hidden="true" className="inline" />
                    </Link>
                  </p>
                )}
                {section.id === "general" && (
                  <p>
                    <a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Terms%20Enquiry">
                      Email admin@bababuilds.com{" "}
                      <ArrowUpRight size={15} aria-hidden="true" className="inline" />
                    </a>
                  </p>
                )}
              </section>
            ))}
            <div className="privacy-last">
              <div>
                <span>HAVE A QUESTION?</span>
                <h2>We build for the people behind every plate.</h2>
                <p>Contact BabaBuilds about your account, Merchant operations or these Terms.</p>
              </div>
              <a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Terms%20Enquiry">
                <Mail size={18} aria-hidden="true" /> Contact the operator
              </a>
            </div>
            <p className="privacy-print-hint">
              <Download size={14} aria-hidden="true" /> Print or save a copy for your records.
            </p>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
