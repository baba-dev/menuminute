import { notFound } from "next/navigation";
import { marketingFeatureBySlug } from "@/content/marketing/features";
import { FeatureLanding } from "@/components/marketing/pages/feature-landing";
import { marketingMetadata } from "@/lib/marketing/seo";

const feature = marketingFeatureBySlug("online-ordering");
export const metadata = marketingMetadata({
  title: "Restaurant Online Ordering and Table QR Orders",
  description:
    "Explore MenuMinute dine-in QR ordering, pickup requests and guest tracking. Ordering requires approved outlet activation.",
  pathname: "/ordering",
});
export default function OrderingPage() {
  if (!feature) notFound();
  return <FeatureLanding feature={feature} />;
}
