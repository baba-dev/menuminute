import React from "react";
import {
  QrCode,
  Smartphone,
  CheckCircle2,
  Clock,
  Flame,
  ChefHat,
  Bell,
  UtensilsCrossed,
  ShoppingBag,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { HelpVisualType } from "@/content/help/contracts";

interface VisualProps {
  type: HelpVisualType;
  caption?: string;
}

export function HelpVisualCard({ type, caption }: VisualProps) {
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="bg-stone-50 p-6 sm:p-8 dark:bg-stone-950/50">
        {type === "qr-card" && <QrCardVisual />}
        {type === "dish-card" && <DishCardVisual />}
        {type === "kds-ticket" && <KdsTicketVisual />}
        {type === "order-stepper" && <OrderStepperVisual />}
        {type === "eight-six-board" && <EightSixBoardVisual />}
        {type === "cart-drawer" && <CartDrawerVisual />}
        {type === "service-bell" && <ServiceBellVisual />}
      </div>
      {caption && (
        <figcaption className="border-t border-stone-100 bg-white px-5 py-3 text-center text-xs font-medium text-stone-500 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function QrCardVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-amber-200/80 bg-gradient-to-b from-amber-50/50 to-white p-6 text-center shadow-md dark:border-amber-900/40 dark:from-stone-900 dark:to-stone-900">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
        <Sparkles className="size-3.5" /> Table 4 Standee
      </div>
      <h4 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100">
        The Rusty Anchor
      </h4>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        Point your camera to browse & order
      </p>

      <div className="relative mx-auto my-5 flex size-44 items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-white p-4 shadow-inner dark:border-stone-700 dark:bg-stone-800">
        <QrCode className="size-32 text-stone-800 dark:text-stone-200" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-white p-1.5 shadow-md dark:bg-stone-900">
            <UtensilsCrossed className="size-6 text-amber-600" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-medium text-stone-600 dark:text-stone-400">
        <Smartphone className="size-4 text-amber-600" />
        <span>No app download needed • Safari or Chrome</span>
      </div>
    </div>
  );
}

function DishCardVisual() {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="relative h-40 bg-gradient-to-tr from-amber-100 to-orange-50 p-4 dark:from-amber-950/40 dark:to-orange-950/20">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold text-stone-800 backdrop-blur-sm dark:bg-stone-900/90 dark:text-stone-200">
            Chef&apos;s Special
          </span>
          <div className="flex gap-1.5">
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Vegetarian
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              Gluten-Free
            </span>
          </div>
        </div>
        <div className="absolute bottom-3 left-4 flex items-center gap-2 text-stone-700 dark:text-stone-300">
          <UtensilsCrossed className="size-5 text-amber-600" />
          <span className="text-xs font-medium">Italian Handmade Pasta</span>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-base font-bold text-stone-900 dark:text-stone-100">
              Wild Truffle & Mushroom Tagliatelle
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              Fresh egg ribbon pasta tossed with slow-roasted wild chanterelles, shaved black
              truffle, and aged parmigiano reggiano.
            </p>
          </div>
          <span className="shrink-0 text-base font-bold text-amber-700 dark:text-amber-400">
            $18.50
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 dark:border-stone-800">
          <span className="text-xs text-stone-400">Nut-free • Contains dairy</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
            Customize &amp; Add &rarr;
          </span>
        </div>
      </div>
    </div>
  );
}

function KdsTicketVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between border-b border-stone-100 pb-3 dark:border-stone-800">
        <div>
          <span className="text-xs font-bold text-amber-600">Ticket #104</span>
          <h4 className="font-bold text-stone-900 dark:text-stone-100">Table 6 • Dine-In</h4>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Clock className="size-3.5" />
          <span>06:45</span>
        </div>
      </div>
      <div className="divide-y divide-stone-100 py-3 text-xs dark:divide-stone-800">
        <div className="py-2">
          <div className="flex justify-between font-semibold text-stone-800 dark:text-stone-200">
            <span>2x Wagyu Smash Burger</span>
            <span>Grill</span>
          </div>
          <p className="mt-0.5 text-stone-500">• Medium rare, No red onions</p>
          <p className="text-stone-500">• Extra aged cheddar</p>
        </div>
        <div className="py-2">
          <div className="flex justify-between font-semibold text-stone-800 dark:text-stone-200">
            <span>1x Truffle Parmesan Fries</span>
            <span>Fryer</span>
          </div>
          <p className="mt-0.5 text-stone-500">• Garlic aioli on the side</p>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          className="flex-1 rounded-lg bg-stone-100 py-2 text-xs font-semibold text-stone-700 dark:bg-stone-800 dark:text-stone-300"
        >
          Station Bump
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
        >
          Mark Ready
        </button>
      </div>
    </div>
  );
}

function OrderStepperVisual() {
  const steps = [
    { title: "Received", status: "completed", time: "12:30 PM" },
    { title: "In Kitchen", status: "active", time: "Cooking now" },
    { title: "Ready", status: "upcoming", time: "Est. 5 min" },
    { title: "Served", status: "upcoming", time: "At table" },
  ];

  return (
    <div className="mx-auto max-w-md rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-stone-400">Order #829 • Table 4</span>
          <h4 className="font-bold text-stone-900 dark:text-stone-100">Meal in Preparation</h4>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <Flame className="size-3.5 text-amber-600" />
          On Schedule
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {steps.map((s) => (
          <div key={s.title} className="flex flex-col items-center">
            <div
              className={`mb-2 flex size-8 items-center justify-center rounded-full text-xs font-bold ${
                s.status === "completed"
                  ? "bg-emerald-600 text-white"
                  : s.status === "active"
                    ? "animate-pulse bg-amber-600 text-white ring-4 ring-amber-100 dark:ring-amber-950"
                    : "bg-stone-100 text-stone-400 dark:bg-stone-800"
              }`}
            >
              {s.status === "completed" ? (
                <CheckCircle2 className="size-4" />
              ) : s.status === "active" ? (
                <ChefHat className="size-4" />
              ) : (
                <Clock className="size-4" />
              )}
            </div>
            <span
              className={`text-xs font-bold ${
                s.status === "active"
                  ? "text-amber-700 dark:text-amber-400"
                  : s.status === "completed"
                    ? "text-stone-900 dark:text-stone-100"
                    : "text-stone-400"
              }`}
            >
              {s.title}
            </span>
            <span className="text-[10px] text-stone-400">{s.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EightSixBoardVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2 dark:border-stone-800">
        <h4 className="font-bold text-stone-900 dark:text-stone-100">86 Board (Availability)</h4>
        <span className="text-xs text-stone-400">1-Click Live Sync</span>
      </div>
      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between rounded-lg bg-stone-50 p-2.5 dark:bg-stone-800/50">
          <div>
            <p className="font-semibold text-stone-800 dark:text-stone-200">
              Artisan Sourdough Loaf
            </p>
            <span className="text-[11px] text-emerald-600">Available to order</span>
          </div>
          <ToggleRight className="size-6 text-emerald-600" />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-stone-50 p-2.5 opacity-75 dark:bg-stone-800/50">
          <div>
            <p className="font-semibold text-stone-500 line-through dark:text-stone-400">
              Fresh Atlantic Salmon
            </p>
            <span className="text-[11px] font-semibold text-rose-600">Sold out for today (86)</span>
          </div>
          <ToggleLeft className="size-6 text-stone-400" />
        </div>
      </div>
    </div>
  );
}

function CartDrawerVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="mb-3 flex items-center justify-between border-b border-stone-100 pb-2 dark:border-stone-800">
        <div className="flex items-center gap-1.5 font-bold text-stone-900 dark:text-stone-100">
          <ShoppingBag className="size-4 text-amber-600" /> Your Order
        </div>
        <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Table 4
        </span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span>1x Margherita Pizza (Crispy Crust)</span>
          <span className="font-semibold">$14.00</span>
        </div>
        <div className="flex justify-between text-stone-500">
          <span>+ Extra Fresh Mozzarella</span>
          <span>$2.00</span>
        </div>
        <div className="flex justify-between">
          <span>2x Iced Mint Lemonade</span>
          <span className="font-semibold">$9.00</span>
        </div>
      </div>
      <div className="mt-4 border-t border-stone-100 pt-3 text-xs dark:border-stone-800">
        <div className="flex justify-between text-sm font-bold text-stone-900 dark:text-stone-100">
          <span>Total</span>
          <span>$25.00</span>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-lg bg-amber-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
        >
          Submit Order to Kitchen &rarr;
        </button>
      </div>
    </div>
  );
}

function ServiceBellVisual() {
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-stone-200 bg-white p-5 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        <Bell className="size-5" />
      </div>
      <h4 className="font-bold text-stone-900 dark:text-stone-100">Need Assistance at Table 4?</h4>
      <p className="mt-1 text-xs text-stone-500">
        Tap to alert your server without waving across the room
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold">
        <button
          type="button"
          className="rounded-lg border border-stone-200 bg-white py-2.5 text-stone-700 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
        >
          💧 Request Water
        </button>
        <button
          type="button"
          className="rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
        >
          💳 Request Bill
        </button>
      </div>
    </div>
  );
}
