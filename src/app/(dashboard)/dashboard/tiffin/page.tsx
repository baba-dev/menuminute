import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { tiffinNavEnabled } from "@/modules/tiffin/dashboard-access";
import "./tiffin.css";

export const metadata: Metadata = {
  title: "Tiffin menu | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function TiffinPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");
  if (!tiffinNavEnabled(outlet.outletType)) notFound();
  return (
    <main className="tiffin-shell">
      <span className="tiffin-eyebrow">Tiffin menu</span>
      <h1>{outlet.name}</h1>
      <p className="tiffin-muted">
        Set up the combos you sell and the menu you publish each week. You write the text;
        MenuMinute does not check it for you.
      </p>
      <div className="tiffin-cards">
        <Link href="/dashboard/tiffin/combos" className="tiffin-card">
          <h2>Combos</h2>
          <p>Create meals with their items, prices and optional add-ons.</p>
        </Link>
        <Link href="/dashboard/tiffin/week" className="tiffin-card">
          <h2>Weekly menu</h2>
          <p>Choose the combos for each weekday and close or change specific dates.</p>
        </Link>
      </div>
    </main>
  );
}
