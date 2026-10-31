import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { coverFor } from "@/modules/menu-product/public-presentation";
import { publicProduct } from "@/modules/menu-product/service";
import { PublicMenu } from "@/components/menu-product/public-menu";
import { GuestOfflineCoordinator } from "@/components/pwa/guest-offline-coordinator";
import { pwaOperationalEnabledForOutlet } from "@/lib/pwa/rollout";

// Must stay dynamic: the page depends on ?lang=, embeds the request time for opening
// hours, and publicProduct re-checks QR revocation in PostgreSQL on every request.
// Caching lives in the Redis layer (modules/menu-product/cache.ts), not the route.
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ publicMenuId: string }>;
  searchParams: Promise<{ lang?: string }>;
};
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const data = await publicProduct((await params).publicMenuId, (await searchParams).lang);
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
export default async function Page({ params, searchParams }: Props) {
  const { publicMenuId } = await params;
  const { lang } = await searchParams;
  const data = await publicProduct(publicMenuId, lang);
  if (!data) notFound();
  return (
    <>
      <GuestOfflineCoordinator
        enabled={pwaOperationalEnabledForOutlet(data.outlet.id)}
        token={publicMenuId}
        locale={data.locale ?? null}
      />
      <PublicMenu key={data.locale ?? "canonical"} initial={data} token={publicMenuId} />
    </>
  );
}
