import { notFound } from "next/navigation";
import { marketingFeatures, marketingFeatureBySlug } from "@/content/marketing/features";
import { FeatureLanding } from "@/components/marketing/pages/feature-landing";
import { marketingMetadata } from "@/lib/marketing/seo";

type PageProps = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return marketingFeatures
    .filter((feature) => feature.path.startsWith("/features/"))
    .map((feature) => ({ slug: feature.slug }));
}
export async function generateMetadata({ params }: PageProps) {
  const feature = marketingFeatureBySlug((await params).slug);
  if (!feature || !feature.path.startsWith("/features/"))
    return { title: "Feature not found", robots: { index: false } };
  return marketingMetadata({
    title: feature.seoTitle,
    description: feature.seoDescription,
    pathname: feature.path,
    image: feature.image ? "/docs-media/" + feature.image + "-desktop-light.webp" : feature.heroArtwork.desktopLight,
    imageAlt: feature.imageAlt || feature.heroArtwork.alt,
  });
}
export default async function FeaturePage({ params }: PageProps) {
  const feature = marketingFeatureBySlug((await params).slug);
  if (!feature || !feature.path.startsWith("/features/")) notFound();
  return <FeatureLanding feature={feature} />;
}
