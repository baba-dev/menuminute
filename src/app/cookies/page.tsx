import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Cookie,
  Download,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "../privacy/privacy.css";
import "./cookies.css";

const PAGE_URL = "https://food.bababuilds.com/cookies";
const DESCRIPTION =
  "Learn how MenuMinute by BabaBuilds uses essential cookies, login sessions and browser storage for QR menus, restaurant tools and preferences.";
const REVIEWED_DATE = "2 November 2026";

export const metadata: Metadata = {
  title: "Cookie Policy — Cookies & Browser Storage",
  description: DESCRIPTION,
  keywords: [
    "MenuMinute cookie policy",
    "MenuMinute cookies",
    "MenuMinute browser storage",
    "MenuMinute privacy and cookie choices",
  ],
  alternates: { canonical: PAGE_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Cookie Policy | MenuMinute by BabaBuilds",
    description: DESCRIPTION,
    type: "website",
    url: PAGE_URL,
    siteName: "MenuMinute",
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
    card: "summary_large_image",
    title: "Cookie Policy | MenuMinute by BabaBuilds",
    description: DESCRIPTION,
    images: ["/brand/social/og-light.webp"],
  },
};

const sections = [
  { id: "overview", title: "1. About this policy" },
  { id: "types", title: "2. What cookies and browser storage are" },
  { id: "inventory", title: "3. What we use today" },
  { id: "third-parties", title: "4. Security services and third parties" },
  { id: "optional", title: "5. Analytics, advertising and consent" },
  { id: "controls", title: "6. How to manage your browser storage" },
  { id: "updates", title: "7. Changes and contact" },
];

const highlights = [
  {
    number: "01",
    title: "Essential services",
    detail: "Secure sign-in and restaurant operations.",
  },
  {
    number: "02",
    title: "Helpful preferences",
    detail: "Appearance, remembered login hints and app choices.",
  },
  {
    number: "03",
    title: "Clear distinctions",
    detail: "Optional tracking is not the same as needed storage.",
  },
];

const storageInventory = [
  {
    purpose: "Sign-in and account protection",
    example: "Better Auth session and related security cookies",
    category: "Essential cookies",
    duration:
      "Session or remembered sign-in; the configured remembered-session lifetime is up to 30 days, with renewal while in use.",
  },
  {
    purpose: "Current restaurant selection",
    example: "menuminute.outlet",
    category: "Functional cookie",
    duration: "Depends on the outlet-selection flow and browser settings.",
  },
  {
    purpose: "Light and dark appearance",
    example: "menuminute.appearance",
    category: "Local storage",
    duration: "Until changed or cleared in this browser.",
  },
  {
    purpose: "Remembered sign-in email when selected",
    example: "menuminute.remembered-email.v1",
    category: "Local storage",
    duration: "Until removed, changed or browser data is cleared.",
  },
  {
    purpose: "Pending sign-in preference",
    example: "menuminute.pending-login.v1",
    category: "Session storage",
    duration: "Cleared after the sign-in flow or when session storage ends.",
  },
  {
    purpose: "Installed-app prompt preference",
    example: "menuminute:pwa-install-dismissed-at",
    category: "Local storage",
    duration:
      "Used to suppress another prompt for approximately 30 days; the entry can remain until cleared.",
  },
  {
    purpose: "Optional remembered guest checkout details",
    example: "menuminute.guest-profile.v1",
    category: "Local storage",
    duration:
      "Written only if the diner ticks “Remember my name and phone on this device”; stores name and phone, never order instructions, and is ignored after 90 days. “Forget saved details” removes it.",
  },
  {
    purpose: "Optional restaurant-side diner profile (when the restaurant has enabled it)",
    example: "menuminute.guest",
    category: "Cookie (httpOnly, Secure)",
    duration:
      "Set only after the diner ticks “Remember my name and phone on this device”; an opaque random value, valid for up to 6 months, scoped to one restaurant group. “Forget saved details” revokes it on the server and deletes the cookie.",
  },
  {
    purpose: "Optional order alerts (when the restaurant has enabled them)",
    example: "menuminute-guest-push (Cache Storage)",
    category: "Cache storage",
    duration:
      "Written only after the diner taps “Notify me about this order”; holds a link to that one order, is ignored after 12 hours and is deleted when the order finishes or alerts are turned off.",
  },
  {
    purpose: "Guest menu cart and installed web-app experience",
    example: "Restaurant-scoped browser state, service worker and offline caches where used",
    category: "Browser storage / cache",
    duration: "Varies by feature, browser and cache lifecycle.",
  },
];

function CookieArtwork() {
  return (
    <svg
      className="privacy-artwork cookies-artwork"
      viewBox="0 0 480 430"
      role="img"
      aria-labelledby="cookies-art-title"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="cookies-art-title">
        A protected browser window holding a warm, illustrated cookie and a privacy checkmark
      </title>
      <defs>
        <linearGradient id="cookie-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe0a5" />
          <stop offset="100%" stopColor="#d77732" />
        </linearGradient>
        <radialGradient id="cookie-glow">
          <stop stopColor="#f6ae6f" stopOpacity=".38" />
          <stop offset="100%" stopColor="#f6ae6f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="240" cy="214" r="195" fill="url(#cookie-glow)" />
      <circle
        className="privacy-art-orbit"
        cx="240"
        cy="214"
        r="169"
        stroke="#e7a65c"
        strokeOpacity=".55"
        strokeDasharray="3 9"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="240" cy="214" r="141" fill="none" stroke="#e7a65c" strokeOpacity=".35" />
      <g className="privacy-art-nodes" fill="#f9bc76">
        <circle cx="240" cy="45" r="5" />
        <circle cx="409" cy="214" r="5" />
        <circle cx="240" cy="383" r="5" />
        <circle cx="71" cy="214" r="5" />
      </g>
      <rect
        x="107"
        y="105"
        width="267"
        height="225"
        rx="28"
        fill="#110c09"
        stroke="#cc945e"
        strokeWidth="2.5"
      />
      <rect x="121" y="119" width="239" height="198" rx="19" fill="#2a1c15" />
      <path d="M121 153h239" stroke="#a87044" strokeWidth="2" strokeOpacity=".65" />
      <circle cx="144" cy="137" r="4" fill="#ffc989" />
      <circle cx="159" cy="137" r="4" fill="#d58751" />
      <circle cx="174" cy="137" r="4" fill="#976041" />
      <path d="M276 137h57" stroke="#b98966" strokeWidth="4" strokeLinecap="round" />
      <circle cx="235" cy="231" r="72" fill="url(#cookie-gold)" />
      <circle
        cx="235"
        cy="231"
        r="62"
        fill="none"
        stroke="#fff0cc"
        strokeOpacity=".42"
        strokeWidth="2"
      />
      <g fill="#854820">
        <circle cx="209" cy="202" r="8" />
        <circle cx="258" cy="210" r="7" />
        <circle cx="241" cy="258" r="9" />
        <circle cx="196" cy="244" r="6" />
        <circle cx="274" cy="243" r="6" />
        <circle cx="232" cy="226" r="5" />
      </g>
      <circle cx="332" cy="287" r="35" fill="#25170e" stroke="#ffd096" strokeWidth="3" />
      <path
        d="m317 287 11 11 20-22"
        stroke="#ffd18c"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M85 223h-20m10-9-10 9 10 9"
        fill="none"
        stroke="#eeb17a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M396 223h20m-10-9 10 9-10 9"
        fill="none"
        stroke="#eeb17a"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function CookiesPage() {
  return (
    <div className="privacy-page cookies-page">
      <a className="privacy-skip" href="#cookie-content">
        Skip to Cookie Policy
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
          <nav className="privacy-header-actions" aria-label="Cookie Policy navigation">
            <Link href="/privacy" className="privacy-back">
              <ArrowLeft size={16} aria-hidden="true" /> Privacy
            </Link>
            <ThemeControl />
          </nav>
        </header>

        <section className="privacy-hero" aria-labelledby="cookie-title">
          <div className="privacy-hero-copy">
            <span className="privacy-eyebrow">
              <span className="privacy-spark" /> 04 / THE COOKIE LEDGER
            </span>
            <h1 id="cookie-title">
              Small files. <em>Clear choices.</em>
            </h1>
            <p>
              What MenuMinute saves in your browser, why it helps the experience work and what you
              can control.
            </p>
            <p className="privacy-review-status">
              Cookie Policy · Reviewed {REVIEWED_DATE}. This page describes the reviewed web
              application, not an opt-in tracking switch.
            </p>
            <div className="privacy-hero-meta">
              <span>Reviewed: {REVIEWED_DATE}</span>
              <span>Operator: BabaBuilds · India</span>
            </div>
          </div>
          <CookieArtwork />
        </section>

        <section className="privacy-principles" aria-label="Our browser storage principles">
          {highlights.map((item) => (
            <div key={item.number}>
              <span>{item.number}</span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
            </div>
          ))}
        </section>

        <div className="privacy-document" id="cookie-content">
          <aside className="privacy-aside">
            <nav aria-label="Cookie Policy contents">
              <p className="privacy-aside-label">ON THIS PAGE</p>
              <ol>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={"#" + section.id}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <Link href="/privacy" className="privacy-aside-contact">
              <ShieldCheck size={17} aria-hidden="true" />
              Read our Privacy Policy <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </aside>

          <main className="privacy-copy" aria-label="Cookie Policy">
            <div className="privacy-note">
              <ShieldCheck size={22} aria-hidden="true" />
              <div>
                <strong>A practical guide to our current setup</strong>
                <p>
                  MenuMinute uses browser storage for sign-in, safety and useful features. This
                  policy also explains optional technologies that would need additional controls
                  before activation. It does not claim that every third-party cookie is set on every
                  visit.
                </p>
              </div>
            </div>
            <details className="privacy-mobile-index">
              <summary>Jump to a section</summary>
              <ol>
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={"#" + section.id}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </details>

            <section className="privacy-section" id="overview" aria-labelledby="overview-heading">
              <h2 id="overview-heading">1. About this policy</h2>
              <p>
                MenuMinute is operated by <strong>BabaBuilds</strong>, a sole proprietorship in
                Pilani, Rajasthan, India. This notice explains cookies, local storage, session
                storage, and related browser technologies used on our website, account dashboards,
                published restaurant QR menus, and progressive web app (PWA) experience.
              </p>
              <p>
                It should be read with our <Link href="/privacy">Privacy Policy</Link>, which
                describes personal data, rights, purposes, retention and contact details. A
                restaurant may separately control information you submit when ordering from its
                menu.
              </p>
            </section>

            <section className="privacy-section" id="types" aria-labelledby="types-heading">
              <h2 id="types-heading">2. What cookies and browser storage are</h2>
              <p>
                A <strong>cookie</strong> is a small value stored by your browser and usually sent
                back with requests to the site that set it. A first-party cookie comes from our
                website. A third-party service may use its own cookies when its feature is loaded.
                Session cookies generally expire when a browser session ends; persistent cookies may
                remain longer.
              </p>
              <p>
                <strong>Local storage</strong> remembers choices in a particular browser until
                changed or cleared. <strong>Session storage</strong> usually lasts for the current
                tab session. <strong>Service workers and cache storage</strong> can help an
                installed PWA load its interface. These are related browser technologies, but they
                are not all cookies and are not all sent to our servers.
              </p>
            </section>

            <section className="privacy-section" id="inventory" aria-labelledby="inventory-heading">
              <h2 id="inventory-heading">3. What we use today</h2>
              <p>
                The following examples are drawn from the current MenuMinute application code. Some
                apply only if you sign in, select a restaurant, use a guest menu, or install the
                PWA. A technical cookie name can vary by environment and authentication
                implementation.
              </p>
              <div
                className="cookies-inventory-scroll"
                role="region"
                aria-label="Cookies and browser storage inventory"
                tabIndex={0}
              >
                <table className="cookies-inventory">
                  <thead>
                    <tr>
                      <th scope="col">Purpose</th>
                      <th scope="col">Cookie or storage example</th>
                      <th scope="col">Type</th>
                      <th scope="col">Duration or retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageInventory.map((item) => (
                      <tr key={item.example}>
                        <th scope="row">{item.purpose}</th>
                        <td>{item.example}</td>
                        <td>{item.category}</td>
                        <td>{item.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Essential sign-in cookies protect authenticated sessions; disabling them may prevent
                account access. Appearance and other preference storage improve convenience. Guest
                cart state and PWA cache are browser-based functionality, not permission to skip
                server-side menu or price validation.
              </p>
            </section>

            <section
              className="privacy-section"
              id="third-parties"
              aria-labelledby="third-parties-heading"
            >
              <h2 id="third-parties-heading">4. Security services and third parties</h2>
              <p>
                MenuMinute uses Cloudflare for infrastructure protection and delivery. Cloudflare
                may use strictly necessary security cookies or challenge-related storage depending
                on request conditions and its active configuration. Cloudflare Turnstile may appear
                in sign-up verification when enabled. These provider-managed technologies are
                distinct from optional marketing or analytics trackers.
              </p>
              <p>
                The exact names and lifetimes of provider-controlled security cookies may change
                with the active Cloudflare features. Visiting a different restaurant&apos;s own
                website or external payment/service destination may involve that site&apos;s
                separate cookie practices.
              </p>
            </section>

            <section className="privacy-section" id="optional" aria-labelledby="optional-heading">
              <h2 id="optional-heading">5. Analytics, advertising and consent</h2>
              <p>
                Our reviewed application code does not activate Google Analytics or advertising
                tracking cookies. We may introduce optional measurement tools in the future, but
                describing a possible integration does not mean it is currently running.
              </p>
              <p>
                Where applicable law requires permission for non-essential analytics, advertising,
                or similar tracking, we must provide an appropriate choice before activating those
                technologies. Essential authentication and security mechanisms are treated
                differently. We do not currently offer a site-wide optional-cookie preference
                switch, and this policy page does not record consent.
              </p>
              <p>
                This review does not replace checking the live Cloudflare configuration, connected
                third-party scripts and future releases. We will update the policy and controls
                before introducing any material new tracking use.
              </p>
            </section>

            <section className="privacy-section" id="controls" aria-labelledby="controls-heading">
              <h2 id="controls-heading">6. How to manage your browser storage</h2>
              <p>
                You can use your browser&apos;s privacy or site-settings menu to view and delete
                cookies and site data for <strong>food.bababuilds.com</strong>. You can also block
                third-party cookies, subject to what your browser supports. Clearing essential
                cookies can sign you out; clearing local storage may reset your theme, remembered
                email, guest cart or installed-app preferences.
              </p>
              <ul>
                <li>
                  Use your browser&apos;s site data or privacy settings to clear cookies and
                  storage.
                </li>
                <li>Change the light or dark appearance using the MenuMinute theme switch.</li>
                <li>Use the sign-in screen to choose whether your email is remembered.</li>
                <li>
                  For an installed PWA, the browser or device&apos;s application/site-data controls
                  can remove cached information.
                </li>
                <li>
                  Contact us if you need assistance with a specific storage or privacy question.
                </li>
              </ul>
              <p>
                Browser controls cannot necessarily erase information already recorded by a
                restaurant or MenuMinute server. To request personal data removal, see our{" "}
                <Link href="/delete-account">account and data deletion page</Link>.
              </p>
              <div className="cookies-tip">
                <MonitorSmartphone size={22} aria-hidden="true" />
                <div>
                  <strong>Using a public restaurant QR menu?</strong>
                  <p>
                    You do not need a MenuMinute account simply to view a published menu. Your
                    browser may still keep temporary menu, cart or offline data for that experience.
                  </p>
                </div>
              </div>
            </section>

            <section className="privacy-section" id="updates" aria-labelledby="updates-heading">
              <h2 id="updates-heading">7. Changes and contact</h2>
              <p>
                We review this notice when relevant cookies, storage, vendors or applicable
                requirements change. The date at the top identifies the application review reflected
                here; it is not a claim that every browser or CDN configuration was independently
                certified on that date.
              </p>
              <p>
                For questions about cookies, site storage or your information, contact{" "}
                <a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Cookie%20Policy">
                  admin@bababuilds.com
                </a>
                . You can also read the <Link href="/privacy">Privacy Policy</Link> and{" "}
                <Link href="/terms">Terms of Service</Link>.
              </p>
            </section>
            <div className="privacy-last">
              <div>
                <span>STILL HAVE QUESTIONS?</span>
                <h2>Clear answers start here.</h2>
                <p>
                  Ask BabaBuilds about cookies, browser storage and privacy choices for MenuMinute.
                </p>
              </div>
              <a href="mailto:admin@bababuilds.com?subject=MenuMinute%20Cookie%20Policy">
                <Mail size={18} aria-hidden="true" /> Contact privacy support
              </a>
            </div>
            <p className="privacy-print-hint">
              <Download size={14} aria-hidden="true" /> Print or save this policy for your records.
            </p>
            <p className="cookies-quiet-footnote">
              <Cookie size={16} aria-hidden="true" /> Last reviewed {REVIEWED_DATE}. This notice
              covers the current web/PWA application, not unshipped native apps.
            </p>
          </main>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
