import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { LiveOrdersBoard } from "./live-orders-board";
import "@/components/orders/service-counter.css";

export const metadata: Metadata = {
  title: "The Service Counter | Orders",
  description: "Private outlet-specific order operations and service history.",
  robots: { index: false, follow: false },
};

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) return <main className="service-counter sc-no-outlet">
    <span className="sc-eyebrow">THE SERVICE COUNTER</span>
    <h1>Select an outlet</h1>
    <p>Choose or create an outlet before managing incoming orders.</p>
    <Link href="/onboarding" className="sc-hero-primary">Set up an outlet →</Link>
  </main>;
  return <LiveOrdersBoard key={outlet.id} organizationId={outlet.organizationId}
    outletId={outlet.id} outletName={outlet.name} currency={outlet.currency} timezone={outlet.timezone}/>;
}
