import { themeScript } from "@/components/menu-product/theme-script";
import { ThemeSync } from "@/components/menu-product/theme-control";
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Sans } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";

import "@/styles/menu-product.css";
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});
const bodyFont = DM_Sans({ subsets: ["latin"], display: "swap", variable: "--font-dm" });

export const metadata: Metadata = {
  title: {
    default: "MenuMinute — Free QR Menus for Restaurants",
    template: "%s | MenuMinute",
  },
  description:
    "Create and publish free digital menus with permanent QR codes. Online ordering and Kitchen Pro are in development.",
  keywords: ["restaurant menu", "QR code menu", "digital menu", "online ordering"],
  authors: [{ name: "MenuMinute" }],
  creator: "MenuMinute",
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "MenuMinute",
  },
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
      <body className={`${displayFont.variable} ${bodyFont.variable} font-sans antialiased`}>
        <ThemeSync />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
