import Link from "next/link";
import { ThemeControl } from "@/components/menu-product/theme-control";
import { QrCode, ArrowRight, Smartphone, Eye, Sparkles } from "lucide-react";
import { generateMenuQrCode } from "@/modules/qr/service";

const DEMO_PUBLIC_ID = "demo-spice-route-kitchen-v1";

export const metadata = {
  title: "Live Interactive Demo — MenuMinute",
  description:
    "Experience the customer QR menu and restaurant dashboard without creating an account.",
};

export default async function DemoPage() {
  const qr = await generateMenuQrCode(DEMO_PUBLIC_ID);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-brand-600 flex h-8 w-8 items-center justify-center rounded-lg">
                <QrCode className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-stone-900">MenuMinute</span>
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <ThemeControl />
              <Link
                href="/login"
                className="hidden text-sm font-medium text-stone-600 hover:text-stone-900 sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
              >
                <span className="sm:hidden">Start free</span>
                <span className="hidden sm:inline">Get started free</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="mb-10 text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            Interactive Experience
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 sm:text-4xl">
            Explore the MenuMinute Demo
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-stone-600 sm:text-base">
            No registration required. Scan the live QR code with your mobile camera or test the
            customer view directly on your browser.
          </p>
        </div>

        <div className="grid items-stretch gap-8 md:grid-cols-2">
          {/* QR Code Experience */}
          <div className="flex flex-col items-center justify-between rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
            <div>
              <div className="mb-2 flex items-center justify-center gap-2">
                <Smartphone className="text-brand-600 h-5 w-5" />
                <h2 className="text-lg font-bold text-stone-900">Scan with Your Phone</h2>
              </div>
              <p className="mx-auto mb-6 max-w-xs text-xs text-stone-500">
                Point your mobile phone camera at this QR code to experience what your diners will
                see at their table.
              </p>

              {/* QR Code display */}
              <div className="inline-block rounded-xl border border-stone-200 bg-stone-50 p-4 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr.dataUrl}
                  alt="MenuMinute Sample QR Code"
                  className="mx-auto h-48 w-48"
                />
              </div>

              <p className="mt-3 font-mono text-[11px] break-all text-stone-400">
                Destination: /m/{DEMO_PUBLIC_ID}
              </p>
            </div>

            <div className="mt-6 w-full border-t border-stone-100 pt-4">
              <Link
                href={`/m/${DEMO_PUBLIC_ID}`}
                className="bg-brand-600 hover:bg-brand-700 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-colors"
              >
                <Eye className="h-4 w-4" />
                Open Customer View in Browser
              </Link>
            </div>
          </div>

          {/* Sample Restaurant Showcase */}
          <div className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
            <div>
              <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
                Sample Restaurant
              </span>
              <h2 className="mt-1 text-2xl font-bold text-stone-900">Spice Route Kitchen</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Authentic North Indian cuisine with a modern twist. Includes 23 dishes across 7
                categories with dietary indicators, spice levels, and pricing in Indian Rupees.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 py-2 text-sm">
                  <span className="text-stone-500">Categories</span>
                  <span className="font-semibold text-stone-800">7 Active</span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-100 py-2 text-sm">
                  <span className="text-stone-500">Menu Items</span>
                  <span className="font-semibold text-stone-800">23 Dishes</span>
                </div>
                <div className="flex items-center justify-between border-b border-stone-100 py-2 text-sm">
                  <span className="text-stone-500">Dietary Flags</span>
                  <span className="font-semibold text-stone-800">Veg, Vegan, Gluten-Free</span>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-stone-500">Pricing Engine</span>
                  <span className="font-semibold text-stone-800">Integer Minor Units (Paise)</span>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3 border-t border-stone-100 pt-4">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-5 py-3 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-100"
              >
                Sign In with Demo Owner Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-center text-[11px] text-stone-400">
                Credentials pre-filled on login page
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
