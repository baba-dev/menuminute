import { getDiagnosticContext } from "@/lib/admin-guard";
import { exitDiagnosticMode } from "@/modules/admin/tenancy.service";
import { verifySuperAdmin } from "@/lib/admin-guard";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AlertTriangle, XCircle } from "lucide-react";

export async function DiagnosticBanner() {
  const diagnostic = await getDiagnosticContext();
  if (!diagnostic.isDiagnostic) return null;

  async function handleExit() {
    "use server";
    const actor = await verifySuperAdmin();
    await exitDiagnosticMode(actor);
    revalidatePath("/", "layout");
    redirect("/admin/organizations");
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-500/15 px-4 py-2.5 text-xs font-medium text-amber-900 backdrop-blur">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse text-amber-700" />
        <span>
          <strong className="font-semibold">Diagnostic Mode Active:</strong> Viewing organization{" "}
          <span className="font-bold underline">{diagnostic.organizationName}</span> (
          {diagnostic.organizationId}). Actions are recorded in the platform audit trail.
        </span>
      </div>
      <form action={handleExit}>
        <button
          type="submit"
          className="inline-flex items-center gap-1 rounded bg-amber-800 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
        >
          <XCircle className="h-3.5 w-3.5" />
          <span>Exit Diagnostic Mode</span>
        </button>
      </form>
    </div>
  );
}
