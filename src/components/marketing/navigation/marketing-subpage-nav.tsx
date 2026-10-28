"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandNavLogo } from "@/components/marketing/brand/brand-nav-logo";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { HomeAuthActions } from "@/components/marketing/hero/home-auth-actions";
import "@/components/marketing/brand/brand-nav-logo.css";

const subpageLinks = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
] as const;

export function MarketingSubpageNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobilePanelId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileOpen]);

  return (
    <nav
      aria-label="Subpage navigation"
      className="border-border bg-background/90 sticky top-0 z-50 border-b backdrop-blur-md transition-colors"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="MenuMinute home">
            <BrandNavLogo />
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden items-center gap-5 md:flex lg:gap-7">
            <Link
              href="/pricing"
              aria-current={pathname === "/pricing" ? "page" : undefined}
              className={`text-sm font-medium transition-colors ${
                pathname === "/pricing"
                  ? "text-brand-800 dark:text-brand-200 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/demo"
              aria-current={pathname === "/demo" ? "page" : undefined}
              className={`text-sm font-medium transition-colors ${
                pathname === "/demo"
                  ? "text-brand-800 dark:text-brand-200 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Demo
            </Link>
            <HomeAuthActions surface="subpage" />
            <ThemeControl />
          </div>

          {/* Mobile Actions & Menu */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeControl />
            <div ref={menuRef} className="relative">
              <button
                ref={triggerRef}
                type="button"
                aria-expanded={mobileOpen}
                aria-controls={mobilePanelId}
                aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
                className="border-border bg-card text-foreground hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl border transition-colors"
                onClick={() => setMobileOpen((curr) => !curr)}
              >
                {mobileOpen ? (
                  <X className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Menu className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              {mobileOpen && (
                <div
                  id={mobilePanelId}
                  className="border-border bg-card text-foreground absolute top-full right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-2xl border p-2 shadow-2xl"
                >
                  {subpageLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={pathname === link.href ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        pathname === link.href
                          ? "bg-muted text-brand-800 dark:text-brand-200"
                          : "text-foreground hover:bg-muted"
                      }`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <div className="border-border my-1 border-t" />
                  <HomeAuthActions surface="subpage" mobile onNavigate={() => setMobileOpen(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
