import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { tiffinNavEnabled } from "@/modules/tiffin/dashboard-access";
import { readTiffinMenu } from "@/modules/tiffin/service";
import { ComboEditor } from "./combo-editor";
import "../tiffin.css";

export const metadata: Metadata = {
  title: "Combos | MenuMinute",
  robots: { index: false, follow: false },
};

export default async function TiffinCombosPage() {
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
          <h1>Combos</h1>
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
      <nav aria-label="Breadcrumb">
        <Link href="/dashboard/tiffin">Tiffin menu</Link>
      </nav>
      <h1>Combos</h1>
      <p className="tiffin-muted">
        Each combo has a fixed price in {menu.outlet.currency}, the items it includes and optional
        add-ons. Archived combos are not offered.
      </p>
      <ComboEditor
        key={outlet.id}
        outletId={outlet.id}
        currency={menu.outlet.currency}
        combos={menu.combos}
        archivedCombos={menu.archivedCombos}
      />
    </main>
  );
}
