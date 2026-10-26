import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookOpenCheck,
  Camera,
  ChefHat,
  ClipboardList,
  QrCode,
  Settings,
  Store,
  Wallet,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { ThemedArtwork } from "@/components/onboarding/themed-artwork";
import "@/components/onboarding/onboarding-wizard.css";
import "./get-started.css";

export const metadata: Metadata = {
  title: "Your restaurant is ready | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function GetStartedPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");

  // A selected goal is a checklist preference, never an entitlement or activation state.
  const goal = outlet.onboardingGoal;
  const priorities = [
    {
      id: "import",
      title: "Import your existing menu",
      detail: "Turn a menu photo or PDF into editable dishes.",
      href: "/dashboard/menu/import",
      Icon: Camera,
    },
    {
      id: "create",
      title: "Build your menu",
      detail: "Add dishes, prices, descriptions and photographs.",
      href: "/dashboard/menu",
      Icon: BookOpenCheck,
    },
    {
      id: "publish",
      title: "Review and publish",
      detail: "Your draft stays private until you explicitly publish.",
      href: "/dashboard/menu",
      Icon: Store,
    },
    {
      id: "qr",
      title: "Prepare your permanent QR",
      detail: "Download and print your restaurant QR after publishing.",
      href: "/dashboard/qr-codes",
      Icon: QrCode,
    },
  ];
  const advanced =
    goal === "qr_menu"
      ? []
      : [
          {
            id: "ordering",
            title: "Prepare online ordering",
            detail: "Set service availability and confirm ordering entitlement.",
            href: "/dashboard/settings",
            Icon: Settings,
          },
          ...(goal === "full_operations"
            ? [
                {
                  id: "kitchen",
                  title: "Configure Kitchen Pro readiness",
                  detail: "Prepare kitchen stations and staff assignments, then seek approval.",
                  href: "/dashboard/orders",
                  Icon: ChefHat,
                },
                {
                  id: "pos",
                  title: "Configure POS and invoicing",
                  detail:
                    "Complete the seller and tax profile before enabling financial operations.",
                  href: "/dashboard/pos",
                  Icon: Wallet,
                },
              ]
            : []),
        ];
  return (
    <div
      className="product"
      style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(1rem,3vw,2rem)" }}
    >
      <section className="wizard-completion-hero">
        <div>
          <span className="wizard-eyebrow">OUTLET CREATED · MENU REMAINS PRIVATE</span>
          <h1 style={{ fontSize: "clamp(1.8rem,4vw,3rem)", fontWeight: 800, lineHeight: 1.13 }}>
            Welcome, {outlet.name}.
          </h1>
          <p style={{ maxWidth: 650, marginTop: "1rem" }}>
            Your restaurant and private menu draft are ready. Choose a starting point and return
            whenever you need to.
          </p>
          <p className="wizard-counter">
            Goal:{" "}
            {goal === "qr_menu"
              ? "QR Menu"
              : goal === "ordering"
                ? "Online Ordering"
                : "Restaurant Operations"}{" "}
            · {outlet.currency} · {outlet.timezone}
          </p>
        </div>
        <ThemedArtwork name="celebration-overlay" width={1000} height={600} />
      </section>
      <section style={{ marginTop: "2rem" }}>
        <h2
          style={{
            fontSize: "1.3rem",
            fontWeight: 700,
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          <ClipboardList size={22} aria-hidden="true" /> Your next steps
        </h2>
        <p className="wizard-counter">
          Only outlet creation is complete. Menu publishing, online orders, Kitchen Pro and POS have
          independent readiness requirements.
        </p>
        <div className="wizard-next-grid">
          {[...priorities, ...advanced].map((item, index) => (
            <Link key={item.id} href={item.href} className="wizard-next-card">
              <item.Icon size={22} color="#f97316" aria-hidden="true" />
              <strong>
                {index + 1}. {item.title}
              </strong>
              <span>{item.detail}</span>
              <span className="wizard-next-link">
                Open workspace <ArrowRight size={15} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
        <Link
          href="/dashboard/menu"
          className="wizard-primary-btn"
          style={{ textDecoration: "none" }}
        >
          Start building your menu <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link href="/dashboard" className="wizard-back-btn" style={{ textDecoration: "none" }}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
