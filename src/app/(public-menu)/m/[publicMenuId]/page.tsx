import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { coverFor } from "@/modules/menu-product/public-presentation";
import { publicProduct } from "@/modules/menu-product/service";
import { PublicMenu } from "@/components/menu-product/public-menu";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ publicMenuId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await publicProduct((await params).publicMenuId);
  if (!data) return { title: "Menu unavailable", robots: { index: false, follow: false } };
  const headline = data.menus[0]?.document.presentation?.headline;
  const description =
    headline ||
    "Explore the digital menu from " +
      data.outlet.name +
      ". Browse dishes and restaurant-supplied descriptions.";
  return {
    title: data.outlet.name + " — Digital Menu",
    description,
    openGraph: {
      title: data.outlet.name + " — Digital Menu",
      description,
      images: [
        {
          url: coverFor(data.menus[0]?.document),
          width: 2172,
          height: 724,
          alt: "Restaurant menu cover",
        },
      ],
    },
  };
}
export default async function Page({ params }: Props) {
  const { publicMenuId } = await params;
  const data = await publicProduct(publicMenuId);
  if (!data) notFound();
  return <PublicMenu initial={data} token={publicMenuId} />;
}
