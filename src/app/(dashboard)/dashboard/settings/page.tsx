import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { Settings, Store, Palette, ShieldCheck, Mail, Phone, MapPin } from "lucide-react";

export const metadata = {
  title: "Restaurant Settings — MenuMinute",
  description: "Configure your restaurant profile and branding settings.",
};

export default async function SettingsPage() {
  const session = await auth();
  const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold text-stone-900">No Restaurant Configured</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <Settings className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">
            Restaurant Profile & Settings
          </h1>
        </div>
        <p className="mt-1 text-xs text-stone-500">
          Manage your restaurant details, branding tokens, and subscription status.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column: Profile Details */}
        <div className="space-y-6 md:col-span-2">
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <h2 className="flex items-center gap-2 border-b border-stone-100 pb-3 text-sm font-bold text-stone-900">
              <Store className="h-4 w-4 text-orange-500" />
              <span>General Information</span>
            </h2>

            <div className="grid gap-4 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-stone-400">Restaurant Name</label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-800">
                  {restaurant.name}
                </p>
              </div>

              <div>
                <label className="mb-1 block font-medium text-stone-400">URL Slug</label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-stone-800">
                  {restaurant.slug}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block font-medium text-stone-400">Description</label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 leading-relaxed text-stone-700">
                  {restaurant.description || "No description set"}
                </p>
              </div>

              <div>
                <label className="mb-1 block flex items-center gap-1 font-medium text-stone-400">
                  <Phone className="h-3 w-3" />
                  <span>Phone Number</span>
                </label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-800">
                  {restaurant.phone || "Not configured"}
                </p>
              </div>

              <div>
                <label className="mb-1 block flex items-center gap-1 font-medium text-stone-400">
                  <Mail className="h-3 w-3" />
                  <span>Email Address</span>
                </label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-800">
                  {restaurant.email || "Not configured"}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block flex items-center gap-1 font-medium text-stone-400">
                  <MapPin className="h-3 w-3" />
                  <span>Physical Address</span>
                </label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-stone-800">
                  {restaurant.addressLine1 ? `${restaurant.addressLine1}, ` : ""}
                  {restaurant.city || ""} {restaurant.postalCode || ""} (
                  {restaurant.country || "IN"})
                </p>
              </div>
            </div>
          </div>

          {/* Branding Card */}
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <h2 className="flex items-center gap-2 border-b border-stone-100 pb-3 text-sm font-bold text-stone-900">
              <Palette className="h-4 w-4 text-orange-500" />
              <span>Theme & Branding</span>
            </h2>

            <div className="grid gap-4 text-xs sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-medium text-stone-400">Primary Color</label>
                <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                  <span
                    className="h-4 w-4 rounded-full border border-stone-300"
                    style={{ backgroundColor: restaurant.primaryColor || "#f97316" }}
                  />
                  <span className="font-mono text-stone-800">
                    {restaurant.primaryColor || "#f97316"}
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-stone-400">Currency Code</label>
                <p className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 font-semibold text-stone-800">
                  {restaurant.currency} (ISO 4217)
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Subscription & Entitlement Card */}
        <div className="space-y-6">
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <h2 className="flex items-center gap-2 border-b border-stone-100 pb-3 text-sm font-bold text-stone-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Current Plan</span>
            </h2>

            <div className="py-2 text-center">
              <span className="text-2xl font-extrabold text-stone-900">Free Forever</span>
              <p className="mt-1 text-xs text-stone-500">₹0 per month</p>
            </div>

            <div className="space-y-2 border-t border-stone-100 pt-3 text-xs text-stone-600">
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Unlimited Menu Categories</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Unlimited Dishes & Items</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Permanent QR Codes</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-emerald-600">✓</span>
                <span>Mobile-Optimised Diner View</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
