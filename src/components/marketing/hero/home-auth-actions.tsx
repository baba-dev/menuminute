"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/** Marketing remains statically rendered; only these two account links hydrate. */
export function HomeAuthActions({
  mobile = false,
  onNavigate,
}: {
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const { data, isPending, error } = authClient.useSession();
  const signedIn = !error && Boolean(data?.user?.emailVerified);
  const navClass = mobile
    ? "food-orbit-hero__mobile-link"
    : "food-orbit-hero__nav-link text-sm font-medium";
  const ctaClass = mobile
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
