import Link from "next/link";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { ArrowRight, Smartphone, Eye, Sparkles, Bot, RefreshCw } from "lucide-react";
import { generateMenuQrCode } from "@/modules/qr/service";
import { DEMO_IDS, demoModeEnabled, DEMO_RESET_INTERVAL_MS } from "@/modules/demo/ids";
import demoMenu from "@/data/demo/demo-menu.json";

const DEMO_PUBLIC_ID = DEMO_IDS.publicId;
const categoryCount = demoMenu.categories.length;
const dishCount = demoMenu.categories.reduce((n, c) => n + c.items.length, 0);

export const metadata = {
  title: "Live Interactive Demo — MenuMinute",
  description:
    "Experience the customer QR menu and restaurant dashboard without creating an account.",
};
const entryNotice: Record<string, string> = {
  unavailable: "The live demo is switched off right now. Please try again later.",
  busy: "Lots of visitors right now. Please try again in a few minutes.",
  denied: "That request could not be verified. Please use the button below.",
  error: "The demo could not start. Please try again in a moment.",
};

export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ entry?: string }>;
}) {
  const { entry } = await searchParams;
  const live = demoModeEnabled();
  const qr = await generateMenuQrCode(DEMO_PUBLIC_ID);

  return (
    <div className="bg-background text-foreground min-h-screen transition-colors">
      <MarketingSubpageNav />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <div className="mb-10 text-center">
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Interactive Experience
          </span>
          <h1 className="font-display text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
            Explore the MenuMinute Demo
          </h1>
          {entry && entryNotice[entry] ? (
            <p
              role="status"
              className="mx-auto mt-4 max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-300"
            >
              {entryNotice[entry]}
            </p>
          ) : null}
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm sm:text-base">
            No registration required. Scan the live QR code with your mobile camera or test the
            customer view directly on your browser.
          </p>
        </div>

        <div className="grid items-stretch gap-8 md:grid-cols-2">
          {/* QR Code Experience */}
          <div className="border-border bg-card text-card-foreground flex flex-col items-center justify-between rounded-2xl border p-8 text-center shadow-sm">
            <div>
              <div className="mb-2 flex items-center justify-center gap-2">
                <Smartphone className="text-brand-600 dark:text-brand-400 h-5 w-5" />
                <h2 className="text-foreground text-lg font-bold">Scan with Your Phone</h2>
              </div>
              <p className="text-muted-foreground mx-auto mb-6 max-w-xs text-xs">
                Point your mobile phone camera at this QR code to experience what your diners will
                see at their table.
              </p>

              {/* QR Code display: preserve pure white paper pad for optical scanner readability */}
              <div className="inline-block rounded-xl border border-stone-200 bg-white p-4 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr.dataUrl}
                  alt="MenuMinute Sample QR Code"
                  className="mx-auto h-48 w-48"
                />
              </div>

              <p className="text-muted-foreground mt-3 font-mono text-[11px] break-all">
                Destination: /m/{DEMO_PUBLIC_ID}
              </p>
            </div>

            <div className="border-border mt-6 w-full border-t pt-4">
              <Link
                href={`/m/${DEMO_PUBLIC_ID}`}
                className="bg-brand-600 hover:bg-brand-700 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors"
              >
                <Eye className="h-4 w-4" />
                Open Customer View in Browser
              </Link>
            </div>
          </div>

          {/* Sample Restaurant Showcase */}
          <div className="border-border bg-card text-card-foreground flex flex-col justify-between rounded-2xl border p-8 shadow-sm">
            <div>
              <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Sample Restaurant
              </span>
              <h2 className="font-display text-foreground mt-1 text-2xl font-bold">
                Spice Route Kitchen
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Authentic North Indian cuisine with a modern twist. Includes {dishCount} dishes
                across {categoryCount} categories with dietary indicators, spice levels and pricing
                in Indian Rupees. All dish details are sample data.
              </p>

              <div className="mt-6 space-y-3">
                <div className="border-border flex items-center justify-between border-b py-2 text-sm">
                  <span className="text-muted-foreground">Categories</span>
                  <span className="text-foreground font-semibold">{categoryCount} Active</span>
                </div>
                <div className="border-border flex items-center justify-between border-b py-2 text-sm">
                  <span className="text-muted-foreground">Menu Items</span>
                  <span className="text-foreground font-semibold">{dishCount} Dishes</span>
                </div>
                <div className="border-border flex items-center justify-between border-b py-2 text-sm">
                  <span className="text-muted-foreground">Dietary Flags</span>
                  <span className="text-foreground font-semibold">Veg, Vegan, Gluten-Free</span>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground">Pricing Engine</span>
                  <span className="text-foreground font-semibold">Integer Minor Units (Paise)</span>
                </div>
              </div>
            </div>

            <div className="border-border mt-8 space-y-3 border-t pt-4">
              {live ? (
                <form action="/demo/enter" method="post" className="space-y-3">
                  <button
                    type="submit"
                    className="border-border bg-muted/60 text-foreground hover:bg-muted inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
                  >
                    Enter the Demo Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-[11px]">
                    <RefreshCw className="h-3 w-3" />
                    Shared demo account. It resets every{" "}
                    {Math.round(DEMO_RESET_INTERVAL_MS / 60000)} minutes.
                  </p>
                  <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-center text-[11px]">
                    <Bot className="h-3 w-3" />
                    Ask the Ember assistant from inside the dashboard.
                  </p>
                </form>
              ) : (
                <p className="text-muted-foreground text-center text-xs">
                  The interactive dashboard demo is not available right now. The customer menu is
                  still open.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}
