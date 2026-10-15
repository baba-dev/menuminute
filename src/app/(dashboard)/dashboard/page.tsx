import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { getCategoriesByRestaurant, getFullMenu } from "@/modules/menus/service";
import {
  UtensilsCrossed,
  Layers,
  QrCode,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  PlusCircle,
  Eye,
} from "lucide-react";

export const metadata = {
  title: "Dashboard Overview — MenuMinute",
  description: "Restaurant management dashboard overview",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const actor = { userId: session.user.id };
  const restaurant = await getDefaultOrActiveRestaurant(actor.userId);

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h2 className="text-lg font-bold text-stone-900">No Restaurant Configured</h2>
        <Link href="/onboarding" className="mt-3 inline-block text-orange-600">
          Create your first outlet
        </Link>
      </div>
    );
  }

  const categories = await getCategoriesByRestaurant(actor, restaurant.id);
  const fullMenu = await getFullMenu(actor, restaurant.id);
  const totalItems = fullMenu.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-stone-900">
              {restaurant.name}
            </h1>
            {restaurant.isDemoData && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                Demo Restaurant
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            {restaurant.addressLine1 ? `${restaurant.addressLine1}, ` : ""}
            {restaurant.city || "India"} • Currency: {restaurant.currency}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href={`/m/${restaurant.publicId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Preview Public Menu</span>
            <ExternalLink className="h-3 w-3 text-stone-400" />
          </Link>

          <Link
            href="/dashboard/menu"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-orange-700"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Manage Menu</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Categories</span>
            <Layers className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">{categories.length}</p>
          <span className="mt-0.5 block text-[11px] text-stone-400">Active menu sections</span>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Dishes & Items</span>
            <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">{totalItems}</p>
          <span className="mt-0.5 block text-[11px] text-stone-400">Available on menu</span>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">QR Code</span>
            <QrCode className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-600">Live</p>
          <span className="mt-0.5 block text-[11px] text-stone-400">Permanent QR token</span>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">Plan</span>
            <ShieldCheck className="h-4 w-4 text-orange-500" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-stone-900">Free</p>
          <span className="mt-0.5 block text-[11px] text-stone-400">No monthly fee</span>
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Menu Slice card */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <UtensilsCrossed className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-stone-900">
                Menu Management (Vertical Slice)
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-stone-600">
              Create, update, and manage categories and menu items with live database persistence.
              Mark items veg/non-veg, configure spice levels, and set prices in minor units.
            </p>
          </div>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <Link
              href="/dashboard/menu"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 transition-colors hover:text-orange-700"
            >
              <span>Go to Menu Editor</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* QR Code card */}
        <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <QrCode className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-stone-900">Permanent QR Code</h2>
            </div>
            <p className="text-xs leading-relaxed text-stone-600">
              Your restaurant&apos;s QR code links to an opaque identifier (
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] text-stone-800">
                {restaurant.publicId}
              </code>
              ). It never breaks if you change your restaurant name or URL slug.
            </p>
          </div>

          <div className="mt-5 border-t border-stone-100 pt-4">
            <Link
              href="/dashboard/qr-codes"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 transition-colors hover:text-orange-700"
            >
              <span>Download & Print QR Codes</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
