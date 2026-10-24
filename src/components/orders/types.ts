export type MerchantOrderItem = {
  id: string;
  orderId: string;
  itemName: string;
  variantName: string | null;
  selectedOptions: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    priceMinor: number;
  }[];
  unitPriceMinor: number;
  totalMinor: number;
  quantity: number;
  notes: string | null;
};
export type MerchantOrder = {
  id: string;
  restaurantId: string;
  orderNumber: number;
  tableId: string | null;
  servicePoint: string | null;
  customerName: string | null;
  customerPhone: string | null;
  fulfillmentMode: string;
  requestedFulfillmentAt?: string | null;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  rejectionReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  kitchenManaged: boolean;
  canAccept: boolean;
  canPrepare: boolean;
  canComplete: boolean;
  canCancel: boolean;
  canManagePayment: boolean;
  items: MerchantOrderItem[];
};
export type ServicePulse = {
  pending: number;
  preparing: number;
  ready: number;
  active: number;
  completedToday: number;
};
export type HistoryResult = {
  orders: MerchantOrder[];
  total: number;
  page: number;
  hasMore: boolean;
};
export type Activity = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  actorType: string;
  createdAt: string;
};
