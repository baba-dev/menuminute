import { themeScript } from "@/components/menu-product/theme-script";
import { ThemeSync } from "@/components/menu-product/theme-control";
import type { Metadata, Viewport } from "next";
import {
  Bebas_Neue,
  Bricolage_Grotesque,
  DM_Sans,
  Kalam,
  Playfair_Display,
} from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";

import "@/styles/menu-product.css";
import "@/styles/public-dining.css";
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});
const bodyFont = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm" });
const handwritingFont = Kalam({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
  variable: "--font-kalam",
});

const printSerif = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-print-playfair",
});
const printDisplay = Bebas_Neue({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-print-bebas",
});

export const metadata: Metadata = {
  title: {
    default: "MenuMinute — Free QR Menus for Restaurants",
    template: "%s | MenuMinute",
  },
  description:
    "Create and publish free digital menus with permanent QR codes. Online ordering and Kitchen Pro are in development.",
  keywords: ["restaurant menu", "QR code menu", "digital menu", "online ordering"],
  applicationName: "MenuMinute",
  icons: {
    icon: [{ url: "/brand/icons/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/brand/icons/favicon.svg",
  },
  authors: [{ name: "MenuMinute" }],
  creator: "MenuMinute",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "MenuMinute",
    images: [
      {
        url: "/brand/social/og-light.webp",
        width: 1200,
        height: 630,
        alt: "MenuMinute by BabaBuilds",
      },
    ],
  },
  twitter: { card: "summary_large_image", images: ["/brand/social/og-light.webp"] },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f97316" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${handwritingFont.variable} ${printSerif.variable} ${printDisplay.variable} font-sans antialiased`}
      >
        <ThemeSync />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
