import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { PublicFooter } from "@/components/marketing/footer/public-footer";

const pages = {
  about: {
    title: "About Menu Minute",
    category: "Company",
    description: "Our story and the people behind the product.",
    detail:
      "This page is being prepared. Menu Minute is a BabaBuilds product designed for beautiful digital restaurant menus.",
  },
  ordering: {
    title: "Online ordering",
    category: "Product roadmap",
    description: "Dine-in and pickup experiences are in development.",
    detail:
      "This feature preview is not an offer of a currently available ordering or payment service. Explore our free QR menu in the meantime.",
  },
  careers: {
    title: "Careers",
    category: "Company",
    description: "Future opportunities to build for the hospitality industry.",
    detail: "Our careers page is being prepared. No open positions are advertised here yet.",
  },
  contact: {
    title: "Contact us",
    category: "Get in touch",
    description: "A dedicated contact experience is on its way.",
    detail:
      "The contact form and support channels are being prepared. For general company information, visit the BabaBuilds website linked below.",
  },
  help: {
    title: "Help centre",
    category: "Resources",
    description: "Getting started and product assistance.",
    detail:
      "Our help centre is being written. You can currently explore the interactive demo or create a free QR menu.",
  },
  faq: {
    title: "Frequently asked questions",
    category: "Resources",
    description: "Quick answers for restaurant owners.",
    detail:
      "We are preparing a reviewed FAQ covering the product, onboarding and upcoming features.",
  },
  guides: {
    title: "Guides & tutorials",
    category: "Resources",
    description: "Learn how to make the most of Menu Minute.",
    detail:
      "Step-by-step guides are being prepared. Browse the interactive demo to explore the QR menu experience.",
  },
  integrations: {
    title: "Integrations",
    category: "Resources",
    description: "Connect your restaurant workflow.",
    detail:
      "Integration documentation and supported provider listings are not published yet. No third-party compatibility is implied.",
  },
  status: {
    title: "System status",
    category: "Resources",
    description: "A dedicated service-status destination is coming.",
    detail:
      "This is a placeholder, not a real-time uptime or incident report. No availability guarantee is implied.",
  },
  terms: {
    title: "Terms of Service",
    category: "Legal · publication pending",
    description: "Our service terms are being finalized.",
    detail:
      "This is a navigation placeholder, not a published Terms of Service agreement. No contractual terms are established by this page.",
  },
  cookies: {
    title: "Cookie Policy",
    category: "Legal · publication pending",
    description: "Our cookie notice is being prepared.",
    detail:
      "This placeholder is not a published cookie inventory or consent notice. A reviewed notice must replace it before publication.",
  },
  "refund-policy": {
    title: "Refund Policy",
    category: "Legal · publication pending",
    description: "Information on future paid plans and refunds.",
    detail:
      "Paid subscription pricing and refund terms are not finalized. This placeholder does not set any purchase or refund conditions.",
  },
  accessibility: {
    title: "Accessibility",
    category: "Legal & inclusion · publication pending",
    description: "Our accessibility information is being prepared.",
    detail:
      "An accessibility statement and verified conformance details have not been published. This page does not assert certification or audit results.",
  },
  security: {
    title: "Security",
    category: "Trust · publication pending",
    description: "How we think about protecting the experience.",
    detail:
      "A reviewed security overview is being prepared. This placeholder does not claim external certification, compliance, or a completed third-party audit.",
  },
} as const;

type InformationSlug = keyof typeof pages;
function getPage(slug: string) {
  return Object.prototype.hasOwnProperty.call(pages, slug) ? pages[slug as InformationSlug] : null;
}
export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getPage(slug);
  return page
    ? { title: page.title, description: page.description, robots: { index: false, follow: true } }
    : { title: "Not found", robots: { index: false } };
}
export default async function InformationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getPage(slug);
  if (!page) notFound();
  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link href="/" aria-label="Menu Minute home">
            <Image
              src="/brand/logos/logo-horizontal-light.svg"
              alt=""
              width={178}
              height={42}
              unoptimized
              className="h-11 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-orange-700"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-start justify-center px-4 py-20 sm:px-6">
        <span className="mb-5 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-xs font-bold tracking-wider text-orange-800 uppercase">
          {page.category}
        </span>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
          {page.title}
        </h1>
        <p className="mt-5 text-xl text-stone-600">{page.description}</p>
        <div className="mt-10 w-full rounded-3xl border border-orange-200 bg-white p-7 shadow-sm sm:p-10">
          <p className="mb-3 text-xs font-extrabold tracking-widest text-orange-700 uppercase">
            Content pending
          </p>
          <p className="max-w-2xl leading-8 text-stone-700">{page.detail}</p>
          <div className="mt-7 flex flex-wrap gap-5">
            <Link
              className="font-semibold text-orange-700 underline underline-offset-4"
              href="/demo"
            >
              Explore the demo
            </Link>
            <a
              className="inline-flex items-center gap-1 font-semibold text-orange-700 underline underline-offset-4"
              href="https://bababuilds.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              BabaBuilds <ArrowUpRight size={15} aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
