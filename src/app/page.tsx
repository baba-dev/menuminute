import type { Metadata } from "next";
import { FoodOrbit } from "@/components/marketing/hero/food-orbit";
import { MenuJourney } from "@/components/marketing/journey/menu-journey";
import { MenuAlchemy } from "@/components/marketing/alchemy/menu-alchemy";
import { OrderConveyor } from "@/components/marketing/order-conveyor/order-conveyor";
import { ChefPass } from "@/components/marketing/chef-pass/chef-pass";
import { ServiceWorlds } from "@/components/marketing/service-worlds/service-worlds";
import { StorefrontStudio } from "@/components/marketing/storefront-studio/storefront-studio";
import { STICKER_DEMO_URL } from "@/components/marketing/storefront-studio/sticker-config";
import QRCode from "qrcode";
import { HomeNav } from "@/components/marketing/navigation/home-nav";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import "./home-layout.css";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "MenuMinute — Free QR Menus for Restaurants",
  description:
    "Create and publish a free digital menu with permanent QR codes. Ordering and Kitchen Pro availability require separate approval.",
};

export default async function HomePage() {
  const qrDataUrl = await QRCode.toDataURL(STICKER_DEMO_URL, {
    type: "image/png",
    errorCorrectionLevel: "H",
    margin: 4,
    scale: 8,
    color: { dark: "#101820", light: "#ffffff" },
  });
  return (
    <div className="mm-homepage min-h-screen bg-stone-50">
      {/* The navigation is part of the hero, not a separate sticky toolbar. */}
      <section className="food-orbit-hero relative isolate overflow-hidden">
        <HomeNav />

        <div className="food-orbit-hero__content relative z-10 mx-auto flex max-w-7xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <h1 className="food-orbit-hero__heading text-4xl leading-[1.06] font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your menu, beautifully digital.
            <span className="food-orbit-hero__accent block">Free forever.</span>
          </h1>
          <div className="food-orbit-hero__stage w-full min-w-0" data-testid="food-orbit-hero-art">
            <div className="food-orbit-hero__art">
              <FoodOrbit />
            </div>
          </div>
          <p className="food-orbit-hero__description max-w-2xl text-base leading-relaxed sm:text-lg">
            Build your restaurant menu, publish it and share one permanent QR code. Guests scan and
            browse without downloading an app or signing up.
          </p>
          <div className="food-orbit-hero__divider" aria-hidden="true" />
        </div>
      </section>

      {/* A three-stage illustrated story, following the Food Orbit hero. */}
      <MenuJourney />

      {/* Editorial preview of planned smart import; no inference runs on this page. */}
      <MenuAlchemy />

      {/* Section 4: illustrated preview of future dine-in and pickup ordering. */}
      <OrderConveyor />

      {/* Section 5: illustrated multi-station Kitchen Pro concept, not a live KDS. */}
      <ChefPass />

      {/* Section 6: original interactive three-service-worlds vector story. */}
      <ServiceWorlds />

      {/* Section 7 — original illustrated, interactive storefront sticker collection. */}
      <StorefrontStudio qrDataUrl={qrDataUrl} />

      <PublicFooter />
    </div>
  );
}
