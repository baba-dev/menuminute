import type { Metadata } from "next";
import { AtlasHeader, AtlasFooter } from "@/components/encyclopedia/atlas";
import "@/components/encyclopedia/atlas.css";

export const metadata: Metadata = {
  title: { default: "The Atlas — Food Encyclopedia", template: "%s | The Atlas · MenuMinute" },
  description:
    "Understand dishes, ingredients, cuisines and the words behind restaurant menus in the MenuMinute Food Encyclopedia.",
  openGraph: { siteName: "MenuMinute", type: "website" },
};

export default function AtlasLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="atlas-root">
      <a className="sr-only focus:not-sr-only" href="#atlas-main">
        Skip to main content
      </a>
      <AtlasHeader />
      {children}
      <AtlasFooter />
    </div>
  );
}
