import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  listRateLimits,
  listAdminAuditLogs,
  clearRateLimitKey,
} from "@/modules/admin/security.service";
import { SecurityConsole } from "./security-console";

export default async function AdminSecurityPage() {
  const actor = await verifySuperAdmin();

  const [rateLimits, auditsRes] = await Promise.all([
    listRateLimits(100),
    listAdminAuditLogs(actor, { limit: 100 }),
  ]);

  async function handleClearRateLimit(key: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    return clearRateLimitKey(currentActor, key);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Security & Audit Control</h1>
        <p className="text-xs text-stone-400">
          Real-time rate limit unblocking, operator intervention trail, and security policy management.
        </p>
      </div>

      <SecurityConsole
        rateLimits={rateLimits}
        auditLogs={auditsRes.logs}
        totalLogs={auditsRes.total}
        onClearRateLimit={handleClearRateLimit}
      />
    </div>
  );
}
