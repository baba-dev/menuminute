"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/** Marketing remains statically rendered; only these two account links hydrate. */
export function HomeAuthActions({
  mobile = false,
  onNavigate,
  surface = "home",
}: {
  mobile?: boolean;
  onNavigate?: () => void;
  /** Subpages must not depend on homepage-only hero CSS. */
  surface?: "home" | "subpage";
}) {
  const { data, isPending, error } = authClient.useSession();
  const signedIn = !error && Boolean(data?.user);
  const navClass =
    surface === "subpage"
      ? mobile
        ? "text-foreground hover:bg-muted block min-h-11 rounded-lg px-3 py-3 text-sm font-semibold transition-colors"
        : "text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
      : mobile
        ? "food-orbit-hero__mobile-link"
        : "food-orbit-hero__nav-link text-sm font-medium";
  const ctaClass =
    surface === "subpage"
      ? mobile
        ? "mm-action mm-action--flow mt-1 min-h-11 rounded-xl px-4 py-3 text-center text-sm font-bold"
        : "mm-action mm-action--flow inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold"
      : mobile
        ? "food-orbit-hero__nav-cta mt-1 rounded-xl px-4 py-3 text-center text-sm font-bold"
        : "food-orbit-hero__nav-cta inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold";
  return (
    <>
      <Link href={signedIn ? "/account" : "/login"} className={navClass} onClick={onNavigate}>
        {isPending ? "My account" : signedIn ? "My account" : "Sign in"}
      </Link>
      <Link
        href={signedIn ? "/dashboard" : isPending ? "/login" : "/register"}
        className={ctaClass}
        onClick={onNavigate}
      >
        {isPending ? "Continue" : signedIn ? "Open Dashboard" : "Get started free"}
      </Link>
    </>
  );
}
