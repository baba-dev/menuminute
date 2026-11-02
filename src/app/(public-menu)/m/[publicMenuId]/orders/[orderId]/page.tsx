import { OrderTracker } from "@/components/menu-product/order-tracker";
import { env } from "@/lib/config/env";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ publicMenuId: string; orderId: string }>;
  searchParams: Promise<{ trackingToken?: string }>;
};

export default async function OrderTrackingPage({ params, searchParams }: Props) {
  const { publicMenuId, orderId } = await params;
  const { trackingToken } = await searchParams;

  return (
    <OrderTracker
      orderId={orderId}
      token={publicMenuId}
      trackingToken={trackingToken || ""}
      live={env.PUBLIC_DINER_STREAM_ENABLED}
      reviews={env.PUBLIC_DINER_REVIEWS_ENABLED}
    />
  );
}
