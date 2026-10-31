import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/config/env";
import { getDefaultOrActiveRestaurant, getRestaurantQrCodes } from "@/modules/restaurants/service";
import { getOutletFloorMatrix } from "@/modules/hospitality/floor-matrix";
import { getFloorLayout, getReservations } from "@/modules/hospitality/floor-service";
import { DiningFloorContainer } from "@/components/dashboard/floor/dining-floor-container";
import "../dashboard-operations.css";
import "./floor-system.css";

export const metadata: Metadata = {
  title: "Dining Floor & Tabletop Studio — MenuMinute",
  description:
    "Interactive visual dining room floor plan, parametric SVG tables & chairs, server assignments, time reservations, and tabletop QR code generator.",
  robots: { index: false, follow: false },
};

/**
 * Visual Dining Floor:
 * Direct-manipulation SVG layout, live order telemetry, time reservations,
 * and tabletop QR standee generator.
 */
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

  // Concurrent loading of layout, order metrics, QR codes, and reservations
  const [layout, orderMatrix, qrCodes, reservations] = await Promise.all([
    getFloorLayout(actor, outlet.id),
    getOutletFloorMatrix(actor, outlet.organizationId, outlet.id),
    getRestaurantQrCodes(actor, outlet.id),
    getReservations(actor, outlet.id),
  ]);

  return (
    <DiningFloorContainer
      initialLayout={layout}
      initialOrderMatrix={orderMatrix}
      initialQrCodes={qrCodes.map(
        ({ id, label, destinationToken, isActive, tableId, pointLabel }) => ({
          id,
          label,
          destinationToken,
          isActive,
          tableId,
          pointLabel,
        })
      )}
      initialReservations={reservations}
      outlet={{
        id: outlet.id,
        organizationId: outlet.organizationId,
        name: outlet.name,
        currency: outlet.currency ?? "INR",
        timezone: outlet.timezone ?? "UTC",
      }}
      origin={env.APP_URL}
      focusTableId={focusTableId}
    />
  );
}
