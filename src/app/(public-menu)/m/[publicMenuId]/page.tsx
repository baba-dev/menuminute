import { notFound } from "next/navigation";
import { publicProduct } from "@/modules/menu-product/service";
import { PublicMenu } from "@/components/menu-product/public-menu";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ publicMenuId: string }> };
export async function generateMetadata({ params }: Props) {
  const data = await publicProduct((await params).publicMenuId);
  return { title: data ? `${data.outlet.name} — Digital Menu` : "Menu unavailable" };
}
export default async function Page({ params }: Props) {
  const { publicMenuId } = await params;
  const data = await publicProduct(publicMenuId);
  if (!data) notFound();
  return <PublicMenu initial={data} token={publicMenuId} />;
}
