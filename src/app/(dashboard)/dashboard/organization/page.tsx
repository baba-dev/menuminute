import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listOrganizations } from "@/modules/organizations/service";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { OrganizationManager } from "./organization-manager";
import "./organization.css";

export const metadata: Metadata = {
  title: "The Hospitality House | Organization",
  description: "Private organization, team, outlets, brands and access workspace.",
  robots: { index: false, follow: false },
};

export default async function OrganizationPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const [organizations, outlet] = await Promise.all([
    listOrganizations({ userId: session.user.id }),
    getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId),
  ]);
  const initialOrganizationId = organizations.some((org) => org.id === outlet?.organizationId)
    ? outlet?.organizationId
    : undefined;
  return <OrganizationManager organizations={organizations} initialOrganizationId={initialOrganizationId} />;
}
