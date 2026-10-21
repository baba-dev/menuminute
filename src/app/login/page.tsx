import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-return";
import { getRestaurantsByUserId } from "@/modules/restaurants/service";
import { LoginForm } from "./login-form";
import { SwitchAccount } from "./switch-account";

export const metadata = { title: "Sign in — MenuMinute", robots: { index: false, follow: false } };

type Query = { next?: string | string[]; switch?: string | string[] };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Query> }) {
  const params = await searchParams;
  const next = safeReturnPath(typeof params.next === "string" ? params.next : null, "");
  // Always validate against PostgreSQL; never trust a remembered-email hint or cookie existence.
  const session = await auth();
  if (session) {
    let destination = next;
    if (!destination) {
      const outlets = await getRestaurantsByUserId(session.user.id);
      destination = outlets.length ? "/dashboard" : "/onboarding";
    }
    if (params.switch === "1")
      return <SwitchAccount email={session.user.email} next={destination} />;
    redirect(destination);
  }
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
