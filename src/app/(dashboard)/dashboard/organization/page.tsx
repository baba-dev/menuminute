import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listOrganizations } from "@/modules/organizations/service";
import { OrganizationManager } from "./organization-manager";
export default async function OrganizationPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const organizations = await listOrganizations({ userId: session.user.id });
  return <OrganizationManager organizations={organizations} />;
}
