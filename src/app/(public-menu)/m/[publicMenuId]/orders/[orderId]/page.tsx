import { OrderTracker } from "@/components/menu-product/order-tracker";

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
    />
  );
}
