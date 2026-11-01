/**
 * Copy for the trust section (home-v2 section 5). Every statement is backed by code or by the
 * product's own docs, and the section claims no certification, uptime, encryption or compliance.
 * Every `href` is an existing public page (checked by tests/trust.test.ts).
 */
export type TrustCard = { title: string; body: string; href: string; cta: string };

export const TRUST_CARDS: readonly TrustCard[] = [
  {
    title: "Two-factor sign-in",
    body: "Turn on authenticator-app two-factor sign-in with backup codes. Sensitive actions ask for a recent second-factor confirmation.",
    href: "/docs/organization",
    cta: "Organization and access",
  },
  {
    title: "Guests need no account",
    body: "Guests scan and browse without signing up or installing an app. Their order is followed with a private tracking link, not a guessable order number.",
    href: "/demo",
    cta: "Try the live demo",
  },
  {
    title: "AI proposes, you decide",
    body: "AI output is an untrusted draft. It never sets allergens, dietary claims, prices or whether an order is accepted, and nothing it drafts publishes without you.",
    href: "/help/owner/ai-menu-import",
    cta: "How review works",
  },
];

export const LEGAL_LINKS = [
  { label: "Privacy notice", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

export const TRUST_NOTE =
  "Illustrative models of checks the product performs: the access rule follows the product's database rule and order handling follows its submission rules. Nothing here is a customer's data, and this page claims no certifications, uptime figures or compliance.";
