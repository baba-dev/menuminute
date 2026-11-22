import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { admitPublicMenuRender } from "@/modules/menu-product/public-ssr-admission";
import { publicWeek } from "@/modules/tiffin/service";
import { PublicWeek } from "@/components/tiffin/public-week";

// Dynamic for the same reasons as the menu page: the week starts at the outlet-local "today" and
// publicWeek re-checks the QR token, flag and publication state in PostgreSQL on every request.
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ publicMenuId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!(await admitPublicMenuRender()))
    return { title: "Menu temporarily unavailable", robots: { index: false, follow: false } };
  const { publicMenuId } = await params;
  const week = await publicWeek(publicMenuId);
  if (!week) return { title: "Menu unavailable", robots: { index: false, follow: false } };
  const name = week.outlet.name;
  return {
    title: name + " — This week's menu",
    description: "See what " + name + " is cooking this week. Menus are set by the owner.",
    alternates: { canonical: "/m/" + publicMenuId + "/week" },
  };
}

export default async function Page({ params }: Props) {
  if (!(await admitPublicMenuRender())) notFound();
  const { publicMenuId } = await params;
  const week = await publicWeek(publicMenuId);
  if (!week) notFound();
  return <PublicWeek week={week} />;
}
