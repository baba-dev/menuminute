import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  adminArchiveTicket,
  adminListTickets,
  adminReplyTicket,
  adminTicketDetail,
  adminUpdateTicket,
} from "@/modules/support/service";
import { SupportConsole } from "./support-console";

export const dynamic = "force-dynamic";

interface SupportPageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    q?: string;
    page?: string;
    archived?: string;
  }>;
}

export default async function AdminSupportPage({ searchParams }: SupportPageProps) {
  const actor = await verifySuperAdmin();
  const sp = await searchParams;
  const status = SUPPORT_STATUSES.find((s) => s === sp.status);
  const priority = SUPPORT_PRIORITIES.find((p) => p === sp.priority);
  const page = Math.min(1000, Math.max(1, parseInt(sp.page || "1", 10) || 1));
  const q = (sp.q ?? "").slice(0, 80);
  const archived = sp.archived === "1";
  const result = await adminListTickets(actor, { status, priority, q, page, archived });

  async function loadTicket(id: string) {
    "use server";
    return adminTicketDetail(await verifySuperAdmin(), id);
  }
  async function updateTicket(
    id: string,
    patch: { status?: string; priority?: string; assign?: "me" | "none" }
  ) {
    "use server";
    const a = await verifySuperAdmin();
    await adminUpdateTicket(a, id, patch);
    return adminTicketDetail(a, id);
  }
  async function replyTicket(id: string, body: string, internal: boolean) {
    "use server";
    const a = await verifySuperAdmin();
    await adminReplyTicket(a, id, { body, internal });
    return adminTicketDetail(a, id);
  }
  async function archiveTicket(id: string, archive: boolean) {
    "use server";
    const a = await verifySuperAdmin();
    await adminArchiveTicket(a, id, archive);
    return adminTicketDetail(a, id);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl dark:text-stone-100">
          Support Desk
        </h1>
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
          Requests raised by restaurant operators, mostly through Ember. Reply, set the status, and
          keep internal notes the operator never sees.
        </p>
      </div>
      <SupportConsole
        tickets={result.tickets}
        counts={result.counts}
        hasNext={result.hasNext}
        page={result.page}
        filters={{ status: status ?? "", priority: priority ?? "", q, archived }}
        currentAdminId={actor.id}
        onLoad={loadTicket}
        onUpdate={updateTicket}
        onReply={replyTicket}
        onArchive={archiveTicket}
      />
    </div>
  );
}
