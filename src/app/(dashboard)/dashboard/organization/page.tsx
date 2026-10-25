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

export default async function OrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ organization?: string | string[] }>;
}) {
  const query = await searchParams;
  const requestedOrganizationId =
    typeof query.organization === "string" ? query.organization : undefined;
  const session = await auth();
  if (!session) redirect("/login");
  const [organizations, outlet] = await Promise.all([
    listOrganizations({ userId: session.user.id }),
    getDefaultOrActiveRestaurant(session.user.id, session.activeOutletId),
  ]);
  // Keep a validated Organization selection across reload, including suspension/recovery.
  const initialOrganizationId =
    organizations.find((org) => org.id === requestedOrganizationId)?.id ??
    organizations.find((org) => org.id === outlet?.organizationId)?.id;
  return (
    <OrganizationManager
      organizations={organizations}
      initialOrganizationId={initialOrganizationId}
    />
  );
}
