import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, HeartHandshake, QrCode, ShieldCheck } from "lucide-react";
import "./public-footer.css";

const groups = [
  { title: "Explore", links: [
    { label: "Features", href: "/#features" }, { label: "Pricing", href: "/pricing" },
    { label: "Interactive demo", href: "/demo" }, { label: "Online ordering", href: "/ordering", soon: true },
    { label: "Start for free", href: "/register" },
  ] },
  { title: "Company & ecosystem", links: [
    { label: "About Menu Minute", href: "/about", soon: true },
    { label: "BabaBuilds website", href: "https://bababuilds.com/", external: true },
    { label: "BabaBuilds ERP", href: "https://erp.bababuilds.com/", external: true },
    { label: "Contact", href: "/contact", soon: true },
    { label: "Careers", href: "/careers", soon: true },
  ] },
  { title: "Resources", links: [
    { label: "Help centre", href: "/help", soon: true }, { label: "FAQs", href: "/faq", soon: true },
    { label: "Guides", href: "/guides", soon: true }, { label: "Integrations", href: "/integrations", soon: true },
    { label: "System status", href: "/status", soon: true },
  ] },
  { title: "Legal", links: [
    { label: "Privacy Policy", href: "/privacy", soon: true }, { label: "Terms of Service", href: "/terms", soon: true },
    { label: "Cookie Policy", href: "/cookies", soon: true }, { label: "Refund Policy", href: "/refund-policy", soon: true },
    { label: "Accessibility", href: "/accessibility", soon: true }, { label: "Security", href: "/security", soon: true },
  ] },
];

function FooterAnchor({ item }: { item: { label: string; href: string; external?: boolean; soon?: boolean } }) {
  const contents = <><span>{item.label}</span>{item.external && <ArrowUpRight size={13} aria-hidden="true" />}{item.soon && <span className="mmf-soon">Soon</span>}</>;
  return item.external
    ? <a href={item.href} target="_blank" rel="noopener noreferrer" className="mmf-link">{contents}<span className="sr-only">(opens in a new tab)</span></a>
    : <Link href={item.href} className="mmf-link">{contents}</Link>;
}

/** Public pages only: not the merchant dashboard or restaurant customer menus. */
export function PublicFooter() {
  return <footer className="mm-public-footer" data-testid="public-footer" aria-label="Menu Minute footer">
    <div className="mmf-container">
      <div className="mmf-intro">
        <div>
          <span className="mmf-eyebrow"><span className="mmf-spark" /> A better way to serve</span>
          <h2>Great food deserves a <em>beautiful first impression.</em></h2>
          <p>From your very first QR menu to the possibilities ahead — thoughtfully made for every kind of restaurant.</p>
        </div>
        <Link href="/register" className="mmf-cta">Create your free menu <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
      <div className="mmf-main">
        <div className="mmf-brand">
          <Link href="/" className="mmf-brand-logo" aria-label="Menu Minute homepage">
            <Image src="/brand/logos/logo-horizontal-dark.svg" alt="" width={660} height={156} unoptimized />
          </Link>
          <p>One little scan. A whole lot of possibilities.</p>
          <div className="mmf-signature">
            <Image src="/brand/icons/icon-master.svg" alt="" width={27} height={27} unoptimized />
            <span>Part of the <a href="https://bababuilds.com/" target="_blank" rel="noopener noreferrer">BabaBuilds <ArrowUpRight size={12} aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span></a> ecosystem.</span>
          </div>
        </div>
        <nav className="mmf-nav" aria-label="Footer navigation">
          {groups.map(group => <div className="mmf-nav-group" key={group.title}>
            <h3>{group.title}</h3>
            <ul>{group.links.map(item => <li key={item.href}><FooterAnchor item={item} /></li>)}</ul>
          </div>)}
        </nav>
      </div>
      <div className="mmf-proof">
        <div className="mmf-trust">
          <div className="mmf-proof-label">Our product principles <span>Menu Minute originals · not external certifications</span></div>
          <div className="mmf-marks">
            <span><QrCode size={18} aria-hidden="true" /> QR-first</span>
            <span><HeartHandshake size={18} aria-hidden="true" /> Restaurant-minded</span>
            <span><ShieldCheck size={18} aria-hidden="true" /> Privacy-conscious design</span>
          </div>
        </div>
        <div className="mmf-payments">
          <div className="mmf-proof-label">Payment options preview <span>Planned · not yet available</span></div>
          <Image src="/brand/footer/payment-options-preview.svg" alt="Illustrative Visa, Mastercard and UPI payment options; planned, not currently accepted by Menu Minute." width={242} height={43} unoptimized />
        </div>
      </div>
      <div className="mmf-bottom">
        <p>© 2026 Menu Minute App - A Subsidiary of BabaBuilds.com.</p>
        <span>Made with care for the people behind every plate. <span aria-hidden="true">✳</span></span>
      </div>
    </div>
  </footer>;
}
