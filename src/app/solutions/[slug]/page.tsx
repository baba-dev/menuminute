import { notFound } from "next/navigation";
import { industrySolutions, industrySolutionBySlug } from "@/content/marketing/solutions";
import { IndustrySolutionPage } from "@/components/marketing/pages/industry-solution";
import { marketingMetadata } from "@/lib/marketing/seo";

type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;

export function generateStaticParams() {
  return industrySolutions.map((solution) => ({ slug: solution.slug }));
}

export async function generateMetadata({ params }: Props) {
  const solution = industrySolutionBySlug((await params).slug);
  if (!solution) return { title: "Solution not found", robots: { index: false } };
  return marketingMetadata({
    title: solution.seoTitle,
    description: solution.seoDescription,
    pathname: "/solutions/" + solution.slug,
    image: solution.cover,
    imageAlt: solution.coverAlt,
  });
}

export default async function SolutionPage({ params }: Props) {
  const solution = industrySolutionBySlug((await params).slug);
  if (!solution) notFound();
  return <IndustrySolutionPage solution={solution} />;
}
