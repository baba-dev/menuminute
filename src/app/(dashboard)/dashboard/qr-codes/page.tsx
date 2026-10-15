import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant, getRestaurantQrCodes } from "@/modules/restaurants/service";
import { listOrganizations } from "@/modules/organizations/service";
import { QrManager } from "@/components/menu-product/qr-manager";
export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  const actor = { userId: session.user.id };
  const outlet = await getDefaultOrActiveRestaurant(actor.userId, session.activeOutletId);
  if (!outlet)
    return (
      <div className="product">
        <h1>Select an outlet</h1>
      </div>
    );
  const org = (await listOrganizations(actor)).find((o) => o.id === outlet.organizationId);
  const codes = await getRestaurantQrCodes(actor, outlet.id);
  return (
    <QrManager
      key={outlet.id}
      initial={codes.map(({ id, label, destinationToken, isActive, tableId }) => ({
        id,
        label,
        destinationToken,
        isActive,
        tableId,
      }))}
      outletId={outlet.id}
      canRevoke={org?.role === "owner" || org?.role === "admin"}
    />
  );
}
