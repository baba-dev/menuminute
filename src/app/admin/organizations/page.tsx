import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  listOrganizations,
  getOrganizationDetails,
  setOrganizationActive,
  setOrganizationMfaRequired,
  enterDiagnosticMode,
} from "@/modules/admin/tenancy.service";
import { OrgsConsole } from "./orgs-console";

interface OrgsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    active?: string;
  }>;
}

export default async function AdminOrganizationsPage({ searchParams }: OrgsPageProps) {
  await verifySuperAdmin();
  const sp = await searchParams;

  const page = parseInt(sp.page || "1", 10) || 1;
  const search = sp.search || "";
  const isActive = sp.active ? sp.active === "true" : undefined;

  const result = await listOrganizations({
    page,
    limit: 20,
    search,
    isActive,
  });

  async function handleFetchDetails(orgId: string) {
    "use server";
    await verifySuperAdmin();
    return getOrganizationDetails(orgId);
  }

  async function handleSetActive(orgId: string, active: boolean, reason: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return setOrganizationActive(currentActor, orgId, active, reason);
  }

  async function handleSetMfaRequired(orgId: string, required: boolean) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return setOrganizationMfaRequired(currentActor, orgId, required);
  }

  async function handleEnterDiagnostic(orgId: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return enterDiagnosticMode(currentActor, orgId);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Organizations & Tenancy Control</h1>
        <p className="text-xs text-stone-400">
          Tenant directory, outlet/brand boundaries, suspension controls, and diagnostic support access.
        </p>
      </div>

      <OrgsConsole
        organizations={result.organizations}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        search={search}
        onFetchDetails={handleFetchDetails}
        onSetActive={handleSetActive}
        onSetMfaRequired={handleSetMfaRequired}
        onEnterDiagnostic={handleEnterDiagnostic}
      />
    </div>
  );
}
