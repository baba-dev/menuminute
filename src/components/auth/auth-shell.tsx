import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import "./auth-experience.css";
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  extra,
  notice,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  extra?: ReactNode;
  /** Full-width notice above the header, e.g. the email-verification nag. */
  notice?: ReactNode;
}) {
  return (
    <div className="mm-auth">
      <a href="#auth-content" className="mm-auth-skip">
        Skip to form
      </a>
      {notice}
      <header className="mm-auth-header">
        <Link className="mm-auth-logo" href="/" aria-label="MenuMinute homepage">
          <Image
            className="mm-auth-logo-light"
            src="/brand/logos/logo-horizontal-light.svg"
            alt="MenuMinute"
            width={660}
            height={156}
            priority
            unoptimized
          />
          <Image
            className="mm-auth-logo-dark"
            src="/brand/logos/logo-horizontal-dark.svg"
            alt=""
            width={660}
            height={156}
            priority
            unoptimized
          />
        </Link>
        <ThemeControl />
      </header>
      <div className="mm-auth-layout">
        <aside className="mm-auth-story" aria-label="MenuMinute">
          <div className="mm-auth-story-inner">
            <span className="mm-auth-overline">MENU MINUTE / YOUR NEXT CHAPTER</span>
            <div className="mm-auth-orbit" aria-hidden="true">
              <span className="mm-auth-orbit-ring mm-auth-orbit-ring-one" />
              <span className="mm-auth-orbit-ring mm-auth-orbit-ring-two" />
              <span className="mm-auth-orbit-core">
                M<span>✦</span>
              </span>
              <span className="mm-auth-orbit-dot mm-auth-orbit-dot-one" />
              <span className="mm-auth-orbit-dot mm-auth-orbit-dot-two" />
            </div>
            <h2>
              Beautiful menus.
              <br />
              <em>Better service.</em>
            </h2>
            <p>One welcoming place for your restaurant, digital menu, orders and kitchen.</p>
            <div className="mm-auth-story-divider" />
            <p className="mm-auth-story-fine">From the first dish to every guest.</p>
          </div>
        </aside>
        <main id="auth-content" className="mm-auth-main">
          <section className="mm-auth-card">
            <span className="mm-auth-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="mm-auth-description">{description}</p>
            {children}
            {extra && <div className="mm-auth-extra">{extra}</div>}
          </section>
          <footer className="mm-auth-footer">
            <span>
              © 2026 BabaBuilds. MenuMinute is a product operated by BabaBuilds, a sole
              proprietorship in Pilani, Rajasthan, India.
            </span>
            <nav aria-label="Legal links">
              <Link href="/terms">Terms of Service</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </nav>
          </footer>
        </main>
      </div>
    </div>
  );
}
