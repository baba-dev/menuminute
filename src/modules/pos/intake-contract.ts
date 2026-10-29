/** Trusted order-intake classification. A public menu session is not proof of a QR camera scan. */
export const orderIntakeSources = ["unknown", "staff_pos", "guest_menu", "online"] as const;
export type OrderIntakeSource = (typeof orderIntakeSources)[number];
export const orderIntakeLabels: Record<OrderIntakeSource, string> = {
  unknown: "Order",
  staff_pos: "Staff POS",
  guest_menu: "Customer menu",
  online: "Online",
};
export const isIncomingCustomerOrder = (source: OrderIntakeSource, status: string) =>
  (source === "guest_menu" || source === "online") && status === "pending";
