"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { HomeAuthActions } from "./home-auth-actions";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
] as const;

export function HomeMobileNavigation() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="flex items-center gap-2 md:hidden">
      <ThemeControl />
      <div ref={rootRef} className="food-orbit-hero__mobile-menu relative">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className="food-orbit-hero__icon-button flex h-11 w-11 items-center justify-center rounded-xl"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {open && (
          <div
            id={panelId}
            className="food-orbit-hero__mobile-panel absolute top-full right-0 z-30 mt-2 flex w-52 flex-col gap-1 rounded-2xl border p-2 shadow-xl"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="food-orbit-hero__mobile-link"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <HomeAuthActions mobile onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>
    </div>
  );
}
