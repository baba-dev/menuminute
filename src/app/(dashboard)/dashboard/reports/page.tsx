import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { reportQuerySchema } from "@/modules/reports/contracts";
import { getReportsWorkspace } from "@/modules/reports/service";
import { ReportsHub } from "@/components/reports/reports-hub";
import "./reports.css";

export const metadata: Metadata = {
  title: "Reports & Insights | MenuMinute",
  description: "Recorded order value, menu performance, cashier settlements and kitchen SLAs.",
  robots: { index: false, follow: false },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");

  const actor = { userId: session.user.id, sessionId: session.session?.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);

  if (!outlet) {
    return (
      <div className="product reports-workspace flex min-h-[50vh] flex-col items-center justify-center p-8 text-center">
        <h1 className="text-xl font-bold">Select an outlet</h1>
        <p className="mt-2 text-sm text-[var(--rep-muted)]">
          Set up an outlet to view operational sales, menu intelligence, and shift reports.
        </p>
        <Link
          href="/onboarding"
          className="reports-hero-primary mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold"
        >
          Set up an outlet
        </Link>
      </div>
    );
  }

  const resolvedParams = await searchParams;
  const rawRange = typeof resolvedParams.range === "string" ? resolvedParams.range : "today";
  const rawFrom = typeof resolvedParams.from === "string" ? resolvedParams.from : undefined;
  const rawTo = typeof resolvedParams.to === "string" ? resolvedParams.to : undefined;
  const rawMode =
    typeof resolvedParams.fulfillmentMode === "string" ? resolvedParams.fulfillmentMode : "all";
  const rawTab = typeof resolvedParams.tab === "string" ? resolvedParams.tab : "overview";

  const query = reportQuerySchema.parse({
    range: rawRange,
    from: rawFrom,
    to: rawTo,
    fulfillmentMode: rawMode,
    tab: rawTab,
  });

  const workspaceData = await getReportsWorkspace(actor, outlet.id, query);

  return <ReportsHub initialData={workspaceData} />;
}
