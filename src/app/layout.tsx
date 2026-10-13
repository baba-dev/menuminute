import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "MenuMinute — Free QR Menus for Restaurants",
    template: "%s | MenuMinute",
  },
  description:
    "Create beautiful digital menus and QR codes for free. Accept online orders and manage your kitchen — built for restaurants of all sizes.",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
