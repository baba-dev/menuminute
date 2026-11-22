import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { tiffinNavEnabled } from "@/modules/tiffin/dashboard-access";
import { readTiffinMenu } from "@/modules/tiffin/service";
import { WeekMenu } from "./week-menu";
import "../tiffin.css";

export const metadata: Metadata = {
  title: "Weekly menu | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function TiffinWeekPage() {
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const outlet = await getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId);
  if (!outlet) redirect("/onboarding");
  if (!tiffinNavEnabled(outlet.outletType)) notFound();
  const actor = { userId: session.user.id, sessionId: session.session.id };
  let menu: Awaited<ReturnType<typeof readTiffinMenu>>;
  try {
    menu = await readTiffinMenu(actor, outlet.id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    if (error instanceof ForbiddenError) {
      return (
        <main className="tiffin-shell">
          <h1>Weekly menu</h1>
          <p className="tiffin-muted" role="alert">
            You do not have permission to view this outlet’s menu. Ask an owner to review your
            access.
          </p>
        </main>
      );
    }
    throw error;
  }
  return (
    <main className="tiffin-shell">
      <nav aria-label="Breadcrumb" className="tiffin-crumbs">
        <Link href="/dashboard/tiffin">Tiffin menu</Link>
        <Link href="/dashboard/tiffin/combos">Combos</Link>
      </nav>
      <h1>Weekly menu</h1>
      <p className="tiffin-muted">
        Choose which of your combos you offer for lunch and dinner each weekday, and close or change
        specific dates. This is your own menu text; MenuMinute does not check it for you.
      </p>
      <WeekMenu
        key={outlet.id}
        outletId={outlet.id}
        timezone={menu.outlet.timezone}
        today={menu.outlet.today}
        combos={menu.combos}
        archivedCombos={menu.archivedCombos}
        slots={menu.slots}
        week={menu.week}
        overrides={menu.overrides}
      />
    </main>
  );
}
