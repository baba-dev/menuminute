import Link from "next/link";
import { ShoppingBag, ArrowRight, Clock, Smartphone, CheckCircle } from "lucide-react";

export const metadata = {
  title: "Online Ordering (Phase C) — MenuMinute",
  description: "Table-based QR ordering and real-time customer order management.",
};

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-stone-900">
            <span>Online Ordering</span>
            <span className="rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
              Phase C Preview (₹149/mo)
            </span>
          </h1>
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-500">
          Online Ordering allows diners to submit orders directly from their tables. The complete
          ordering pipeline will be implemented in Phase C.
        </p>
      </div>

      <div className="mx-auto max-w-2xl rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
          <ShoppingBag className="h-8 w-8" />
        </div>

        <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
          Planned Phase C Feature
        </span>

        <h2 className="text-xl font-bold text-stone-900">Table-Based Dine-in Ordering</h2>

        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-stone-600">
          In Phase C, your diners will be able to add dishes to their cart and submit orders
          directly from their smartphone without needing to install an app or create an account.
        </p>

        <div className="mt-6 space-y-3.5 rounded-xl border border-stone-200 bg-stone-50 p-5 text-left">
          <div className="flex items-start gap-2.5">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-xs font-bold text-stone-900">Frictionless Table Ordering</p>
              <p className="text-[11px] text-stone-500">
                No app download or user account required for diners.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-xs font-bold text-stone-900">Live Status Tracking</p>
              <p className="text-[11px] text-stone-500">
                Real-time status updates from receipt to preparation and delivery.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-xs font-bold text-stone-900">Affordable Flat Pricing</p>
              <p className="text-[11px] text-stone-500">
                Flat ₹149/month with 0% commission on orders.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-3 border-t border-stone-100 pt-4">
          <Link
            href="/dashboard/menu"
            className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-orange-700"
          >
            <span>Configure Dishes & Pricing First</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
