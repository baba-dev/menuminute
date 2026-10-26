/** Shared, guest-safe status presentation; payment is a separate state. */
export type OrderStamp = "sold-out" | "paid" | "complete" | "confirmed" | "chef-pick";
export function getOrderStampVariant(status: string): OrderStamp {
  if (["rejected", "cancelled", "expired"].includes(status)) return "sold-out";
  if (["served", "collected", "delivered"].includes(status)) return "complete";
  if (["accepted", "confirmed", "preparing", "ready"].includes(status)) return "confirmed";
  return "chef-pick";
}
export function getGuestOrderNote(status: string, fulfillmentMode: string, point: string | null): string {
  switch (status) {
    case "pending": return "Your request was sent. The restaurant has not accepted it yet.";
    case "accepted": case "confirmed": return "Your order was accepted by the restaurant. Preparation has not necessarily started.";
    case "preparing": return "The restaurant reports that your order is being prepared.";
    case "ready": return fulfillmentMode === "pickup" ? "Your order is ready for pickup. Please follow the restaurant's collection instructions." : point ? `Your order is ready for handoff at ${point}.` : "Your order is ready for handoff. Please follow staff instructions.";
    case "served": case "collected": case "delivered": return "Your order has been marked complete by the restaurant.";
    case "rejected": return "The restaurant could not accept this request. Review the reason below or contact staff.";
    case "cancelled": return "This order was cancelled. Contact the restaurant if you need assistance.";
    case "expired": return "This order was not accepted before the deadline. Please contact the restaurant.";
    default: return "Check the latest order status below or contact the restaurant.";
  }
}
