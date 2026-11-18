import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { MarketingPageShell } from "@/components/marketing/pages/marketing-page-shell";
import { marketingMetadata } from "@/lib/marketing/seo";

export const metadata = marketingMetadata({
  title: "MenuMinute Brochure for Restaurant Owners (PDF)",
  description:
    "Download the MenuMinute brochure: beautiful QR menus, clearer orders and a kitchen in sync, for restaurants, cafés, bakeries, dhabas and cloud kitchens.",
  pathname: "/brochure",
  image: "/brochure/page-01.webp",
  imageAlt: "MenuMinute restaurant brochure cover",
});

const previews = [
  {
    src: "/brochure/page-01.webp",
    alt: "Brochure page 1: Great food. Smoother service. Happier you.",
  },
  {
    src: "/brochure/page-02.webp",
    alt: "Brochure page 2: The food needs you. The paperwork doesn't.",
  },
  { src: "/brochure/page-03.webp", alt: "Brochure page 3: Make your menu hard to put down." },
];

export default function BrochurePage() {
  return (
    <MarketingPageShell>
      <section className="border-border via-background border-b bg-gradient-to-br from-orange-500/10 to-amber-500/10">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:px-8">
          <p className="text-xs font-bold tracking-[0.2em] text-orange-700 uppercase dark:text-orange-300">
            Made for restaurant owners
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-4xl leading-[1.12] font-extrabold tracking-tight sm:text-5xl">
            Great food. Smoother service.{" "}
            <span className="text-orange-600 dark:text-orange-400">Happier you.</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-8">
            Beautiful QR menus. Clearer orders. A kitchen in sync. Read the MenuMinute brochure for
            restaurants, cafés, bakeries, dhabas and cloud kitchens, or share it with your team.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/brochure/MenuMinute-Restaurant-Brochure.pdf"
              download
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-orange-600/10 transition hover:bg-orange-700"
            >
              <Download size={18} aria-hidden="true" />
              Download the brochure (PDF, 10 pages, about 19 MB)
            </a>
            <Link
              href="/register"
              className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold transition"
            >
              Create your free QR menu <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link
              href="/help/guide"
              className="border-border bg-card hover:bg-muted inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-6 py-3 text-sm font-bold transition"
            >
              Illustrated user guide (English + हिंदी) <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-extrabold">A look inside</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-3">
          {previews.map((p) => (
            <li
              key={p.src}
              className="overflow-hidden rounded-2xl border border-stone-200 shadow-sm dark:border-stone-800"
            >
              <Image
                src={p.src}
                alt={p.alt}
                width={720}
                height={1018}
                sizes="(max-width: 640px) 100vw, 320px"
                className="h-auto w-full"
              />
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-6 text-sm">
          The brochure is a PDF. Open it on your phone, computer or share it on WhatsApp.
        </p>
      </section>
    </MarketingPageShell>
  );
}
