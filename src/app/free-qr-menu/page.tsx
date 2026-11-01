import { notFound } from "next/navigation";
import { marketingFeatureBySlug } from "@/content/marketing/features";
import { FeatureLanding } from "@/components/marketing/pages/feature-landing";
import { marketingMetadata } from "@/lib/marketing/seo";

const feature = marketingFeatureBySlug("free-qr-menu");
export const metadata = marketingMetadata({
  title: "Free QR Menu Maker for Restaurants",
  description: "Create a free restaurant QR menu. Add dishes, categories and prices, publish a mobile-friendly menu and download permanent QR codes.",
  pathname: "/free-qr-menu",
});
export default function FreeQrMenuPage() {
  if (!feature) notFound();
  return <FeatureLanding feature={feature} />;
}
