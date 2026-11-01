import type { ReactNode } from "react";
import { MarketingSubpageNav } from "@/components/marketing/navigation/marketing-subpage-nav";
import { PublicFooter } from "@/components/marketing/footer/public-footer";
export function MarketingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <MarketingSubpageNav />
      <main id="main-content" className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
