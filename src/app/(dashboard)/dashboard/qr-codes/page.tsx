import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { generateMenuQrCode } from "@/modules/qr/service";
import { QrCode, Download, ExternalLink, ShieldCheck, Smartphone, Printer } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "QR Code Management — MenuMinute",
  description: "View and download permanent QR codes for your restaurant menu.",
};

export default async function QrCodesPage() {
  const session = await auth();
  const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

  if (!restaurant) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <h2 className="text-base font-bold text-stone-900">No Restaurant Configured</h2>
      </div>
    );
  }

  const qr = await generateMenuQrCode(restaurant.publicId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
            <QrCode className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-stone-900">Permanent QR Codes</h1>
        </div>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-500">
          Each QR code is generated with a permanent opaque destination token. You can safely print
          these QR codes for table tents and flyers — they will never break even if you change your
          restaurant name or URL slug.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-2">
        {/* QR Preview Card */}
        <div className="flex flex-col items-center rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-xs">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 shadow-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.dataUrl}
              alt={`${restaurant.name} QR Code`}
              className="mx-auto h-56 w-56"
            />
          </div>

          <h2 className="mt-4 text-base font-bold text-stone-900">{restaurant.name}</h2>
          <p className="mt-0.5 font-mono text-xs break-all text-stone-500">{qr.destinationUrl}</p>

          <div className="mt-6 flex w-full flex-wrap justify-center gap-2">
            <a
              href={qr.dataUrl}
              download={`${restaurant.slug}-menu-qr.png`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-orange-700"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </a>

            <Link
              href={`/m/${restaurant.publicId}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-200"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Test Live Menu</span>
            </Link>
          </div>
        </div>

        {/* Instructions & Features */}
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-xs">
            <h3 className="flex items-center gap-2 text-sm font-bold text-stone-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Zero-Break Guarantee</span>
            </h3>

            <p className="text-xs leading-relaxed text-stone-600">
              Traditional URL-based QR codes stop working if you change your restaurant&apos;s
              subdomain or name. MenuMinute assigns a permanent UUID-grade token (
              <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] text-stone-800">
                {restaurant.publicId}
              </code>
              ) that guarantees permanent link survival.
            </p>

            <div className="space-y-2.5 border-t border-stone-100 pt-3">
              <div className="flex items-start gap-2.5 text-xs text-stone-600">
                <Printer className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span>
                  Print on table stands, acrylic stands, window stickers, and physical receipts.
                </span>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-stone-600">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
                <span>
                  Compatible with native iOS camera, Android Google Lens, and all QR scanner apps.
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs leading-relaxed text-amber-900">
            <span className="mb-1 block font-bold">Coming in Phase C: Table-Specific QR Codes</span>
            Generate unique QR codes for Table 1, Table 2, etc. Customers scanning table codes will
            have orders automatically routed to their specific table in the Kitchen Pro display.
          </div>
        </div>
      </div>
    </div>
  );
}
