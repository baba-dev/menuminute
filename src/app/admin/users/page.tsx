import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  listUsers,
  getUserDetails,
  toggleUserVerification,
  revokeUserSessions,
  unlockUserTwoFactor,
  setUserSuperAdmin,
} from "@/modules/admin/users.service";
import { UsersConsole } from "./users-console";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    verified?: string;
    twoFactor?: string;
    superAdmin?: string;
  }>;
}

export default async function AdminUsersPage({ searchParams }: UsersPageProps) {
  await verifySuperAdmin();
  const sp = await searchParams;

  const page = parseInt(sp.page || "1", 10) || 1;
  const search = sp.search || "";
  const filterVerified = sp.verified ? sp.verified === "true" : undefined;
  const filter2FA = sp.twoFactor ? sp.twoFactor === "true" : undefined;
  const filterSuperAdmin = sp.superAdmin ? sp.superAdmin === "true" : undefined;

  const result = await listUsers({
    page,
    limit: 20,
    search,
    filterVerified,
    filter2FA,
    filterSuperAdmin,
  });

  async function handleFetchDetails(userId: string) {
    "use server";
    await verifySuperAdmin();
    return getUserDetails(userId);
  }

  async function handleToggleVerify(userId: string, verified: boolean) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return toggleUserVerification(currentActor, userId, verified);
  }

  async function handleRevokeSessions(userId: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return revokeUserSessions(currentActor, userId);
  }

  async function handleUnlock2FA(userId: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return unlockUserTwoFactor(currentActor, userId);
  }

  async function handleToggleSuperAdmin(userId: string, enable: boolean) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return setUserSuperAdmin(currentActor, userId, enable);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Users & Accounts Control</h1>
        <p className="text-xs text-stone-400">
          Global directory, email verification states, 2FA recovery, session revocation, and superadmin elevation.
        </p>
      </div>

      <UsersConsole
        users={result.users}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        search={search}
        onFetchDetails={handleFetchDetails}
        onToggleVerification={handleToggleVerify}
        onRevokeSessions={handleRevokeSessions}
        onUnlockTwoFactor={handleUnlock2FA}
        onToggleSuperAdmin={handleToggleSuperAdmin}
      />
    </div>
  );
}
