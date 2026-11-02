import { notFound } from "next/navigation";
import { marketingFeatureBySlug } from "@/content/marketing/features";
import { FeatureLanding } from "@/components/marketing/pages/feature-landing";
import { marketingMetadata } from "@/lib/marketing/seo";

const feature = marketingFeatureBySlug("online-ordering");
export const metadata = marketingMetadata({
  title: "Restaurant Online Ordering and Table QR Orders",
  description:
    "Explore MenuMinute dine-in QR ordering, pickup orders and guest tracking. Included from the Ordering plan at ₹119 a month.",
  pathname: "/ordering",
  image: "/docs-media/orders-desktop-light.webp",
  imageAlt: "MenuMinute restaurant order tickets and status",
});
export default function OrderingPage() {
  if (!feature) notFound();
  return <FeatureLanding feature={feature} />;
}
