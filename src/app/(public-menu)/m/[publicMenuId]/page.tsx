import { notFound } from "next/navigation";
import { getPublicMenu } from "@/modules/restaurants/service";
import { formatPrice } from "@/lib/utils";
import { QrCode, Phone, MapPin, Sparkles, Flame, Leaf } from "lucide-react";

interface PublicMenuPageProps {
  params: Promise<{
    publicMenuId: string;
  }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PublicMenuPageProps) {
  const { publicMenuId } = await params;
  const projection = await getPublicMenu(publicMenuId);
  const restaurant = projection?.restaurant;

  if (!restaurant) {
    return {
      title: "Menu Not Found | MenuMinute",
    };
  }

  return {
    title: `${restaurant.name} — Digital Menu`,
    description: restaurant.description || `Browse the digital menu for ${restaurant.name}`,
  };
}

export default async function PublicMenuPage({ params }: PublicMenuPageProps) {
  const { publicMenuId } = await params;
  const projection = await getPublicMenu(publicMenuId);
  const restaurant = projection?.restaurant;

  if (!restaurant) {
    notFound();
  }

  const menu = projection!.menu;

  return (
    <div className="min-h-screen bg-stone-50 pb-20 text-stone-900">
      {/* Top Banner / Restaurant Info */}
      <header
        className="relative overflow-hidden border-b border-stone-200 bg-white shadow-sm"
        style={{
          borderTopColor: restaurant.primaryColor || "#f97316",
          borderTopWidth: "4px",
        }}
      >
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 md:text-3xl">
                  {restaurant.name}
                </h1>
                {restaurant.isDemoData && (
                  <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    Sample Menu
                  </span>
                )}
              </div>
              {restaurant.description && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
                  {restaurant.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-stone-500">
                {restaurant.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-stone-400" />
                    {restaurant.phone}
                  </span>
                )}
                {restaurant.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-stone-400" />
                    {restaurant.addressLine1 ? `${restaurant.addressLine1}, ` : ""}
                    {restaurant.city}
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600">
                Currency: {restaurant.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Category sticky nav bar */}
        {menu.length > 0 && (
          <nav className="no-scrollbar sticky top-0 z-30 overflow-x-auto border-t border-stone-100 bg-white/95 px-4 py-2.5 shadow-xs backdrop-blur-sm">
            <div className="mx-auto flex max-w-3xl gap-2">
              {menu.map(({ category }) => (
                <a
                  key={category.id}
                  href={`#category-${category.id}`}
                  className="shrink-0 rounded-full bg-stone-100 px-3.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
                >
                  {category.name}
                </a>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Menu Categories and Items */}
      <main className="mx-auto mt-6 max-w-3xl space-y-10 px-4">
        {menu.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 py-16 text-center shadow-xs">
            <QrCode className="mx-auto mb-3 h-12 w-12 text-stone-300" />
            <h3 className="text-base font-semibold text-stone-800">No items on this menu yet</h3>
            <p className="mt-1 text-sm text-stone-500">
              Check back soon or ask the staff for today&apos;s special offerings.
            </p>
          </div>
        ) : (
          menu.map(({ category, items }) => (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-16">
              <div className="mb-4 border-b border-stone-200 pb-2">
                <h2 className="text-lg font-bold tracking-tight text-stone-900">{category.name}</h2>
                {category.description && (
                  <p className="mt-0.5 text-xs text-stone-500">{category.description}</p>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No available items in this section.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-sm"
                    >
                      <div>
                        {item.imageUrl && (
                          <div className="relative mb-3 overflow-hidden rounded-lg">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className={`h-36 w-full object-cover ${item.isAvailable ? "" : "opacity-60 grayscale"}`}
                            />
                            {!item.isAvailable && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30 font-bold text-white">
                                Sold Out
                              </span>
                            )}
                          </div>
                        )}
                        {!item.isAvailable && !item.imageUrl && (
                          <p className="mb-2 font-semibold text-stone-600">Sold Out</p>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.isVeg !== null && item.isVeg !== undefined && (
                              <span
                                className={`inline-flex items-center justify-center rounded border p-0.5 text-[10px] ${
                                  item.isVeg
                                    ? "border-emerald-600 text-emerald-600"
                                    : "border-red-600 text-red-600"
                                }`}
                                title={item.isVeg ? "Vegetarian" : "Non-Vegetarian"}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    item.isVeg ? "bg-emerald-600" : "bg-red-600"
                                  }`}
                                />
                              </span>
                            )}
                            <h3 className="text-sm font-semibold text-stone-900">{item.name}</h3>
                          </div>

                          <span className="shrink-0 text-sm font-bold text-stone-900">
                            {formatPrice(item.pricePaise, restaurant.currency)}
                          </span>
                        </div>

                        {item.description && (
                          <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-stone-600">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Dietary badges & Spice level */}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2">
                        {item.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            <Sparkles className="h-3 w-3 text-amber-500" />
                            Popular
                          </span>
                        )}
                        {item.isVegan && (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <Leaf className="h-3 w-3 text-emerald-600" />
                            Vegan
                          </span>
                        )}
                        {item.isGlutenFree && (
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                            GF
                          </span>
                        )}
                        {(item.spiceLevel ?? 0) > 0 && (
                          <span
                            className="inline-flex items-center rounded bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-600"
                            title={`Spice level ${item.spiceLevel}/3`}
                          >
                            <Flame className="mr-0.5 h-3 w-3" />
                            {"🌶️".repeat(item.spiceLevel ?? 0)}
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>

      {/* Footer Branding */}
      <footer className="mt-16 text-center text-xs text-stone-400">
        <div className="inline-flex items-center gap-1">
          <span>Powered by</span>
          <span className="font-semibold text-stone-600">MenuMinute</span>
        </div>
      </footer>
    </div>
  );
}
