import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { getOutletFloorMatrix } from "@/modules/hospitality/floor-matrix";
import { TableFloorMatrix } from "@/components/dashboard/table-floor-matrix";
import { ServiceRequestsPanel } from "@/components/dashboard/service-requests-panel";
import "../dashboard-operations.css";

export const metadata: Metadata = {
  title: "Dining floor",
  description: "Tables, unpaid balances and guest requests for the selected outlet.",
  robots: { index: false, follow: false },
};

/** The dining room on its own page, so staff on a phone reach it in one tap. */
export default async function FloorPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) {
    return (
      <div className="mm-dashboard product mm-floor-page">
        <h1>Select an outlet</h1>
        <p>Set up an outlet to see its dining floor.</p>
        <Link href="/onboarding">Set up an outlet</Link>
      </div>
    );
  }
  const raw = (await searchParams)["table"];
  const focusTableId =
    typeof raw === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : undefined;
  const actor = { userId: session.user.id };
  // A restricted or failing read is shown as "unavailable", never as an empty room.
  const tables = await getOutletFloorMatrix(actor, outlet.organizationId, outlet.id).catch(
    () => null
  );
  return (
    <div className="mm-dashboard product mm-floor-page" data-testid="floor-page">
      <header>
        <h1>Dining floor</h1>
        <p>{outlet.name} · tables, unpaid balances and guest requests.</p>
      </header>
      <div className="mm-floor-grid">
        <TableFloorMatrix
          tables={tables}
          currency={outlet.currency ?? "INR"}
          focusTableId={focusTableId}
        />
        <ServiceRequestsPanel
          organizationId={outlet.organizationId}
          outletId={outlet.id}
          timezone={outlet.timezone}
        />
      </div>
    </div>
  );
}
