import type { Schedule } from "@/modules/menu-product/contracts";

export type OutletType = "restaurant" | "cafe" | "takeout" | "cloud_kitchen" | "hotel" | "mixed";

export type FulfillmentMode = "dine_in" | "pickup";

export interface WizardDraft {
  name: string;
  outletType: OutletType;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  email: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  timezone: string;
  fulfillmentModes: FulfillmentMode[];
  pickupLeadMinutes: number;
  pickupSlotMinutes: number;
  pickupAdvanceDays: number;
  tableCount: number;
  menuSchedule: Schedule | null;
  // First-time goal configures a checklist, not a subscription entitlement.
  onboardingGoal: "qr_menu" | "ordering" | "full_operations";
  operatingHours: Schedule | null;
  serviceHours: Schedule | null;
  operationsContactName: string;
  operationsContactPhone: string;
  operationsContactEmail: string;
}

export const initialWizardDraft: WizardDraft = {
  name: "",
  outletType: "restaurant",
  description: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "IN",
  latitude: null,
  longitude: null,
  phone: "",
  email: "",
  website: "",
  primaryColor: "#f97316",
  secondaryColor: "#1c1917",
  currency: "INR",
  timezone: "Asia/Kolkata",
  fulfillmentModes: ["dine_in"],
  pickupLeadMinutes: 15,
  pickupSlotMinutes: 15,
  pickupAdvanceDays: 7,
  tableCount: 10,
  menuSchedule: null,
  onboardingGoal: "qr_menu",
  operatingHours: null,
  serviceHours: null,
  operationsContactName: "",
  operationsContactPhone: "",
  operationsContactEmail: "",
};
