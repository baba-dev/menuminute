import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { reportQuerySchema } from "@/modules/reports/contracts";
import { getReportsWorkspace } from "@/modules/reports/service";
import { ZReportPreview } from "@/components/reports/z-report-preview";
import "../reports.css";

export const metadata: Metadata = {
  title: "Daily Z-Report | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function ZReportStandalonePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");

  const actor = { userId: session.user.id, sessionId: session.session?.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);

  if (!outlet) redirect("/dashboard");

  const resolvedParams = await searchParams;
  const rawDate = typeof resolvedParams.date === "string" ? resolvedParams.date : undefined;

  const query = reportQuerySchema.parse({
    range: rawDate ? "custom" : "today",
    from: rawDate,
    to: rawDate,
    tab: "z-report",
  });

  const workspaceData = await getReportsWorkspace(actor, outlet.id, query);

  return (
    <div className="product reports-workspace p-6">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-2 text-xs font-bold text-[var(--rep-muted)] hover:text-[var(--rep-ink)]"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to Reports & Insights
        </Link>
      </div>

      <ZReportPreview report={workspaceData.dailyZReport} />
    </div>
  );
}
