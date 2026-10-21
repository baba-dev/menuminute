"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  Store,
  Users,
  ExternalLink,
  Shield,
} from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  isActive: boolean;
  mfaRequired: boolean;
  version: number;
  createdAt: string | Date;
  outletCount: number;
  memberCount: number;
}

interface OrgDetailPayload {
  organization: {
    id: string;
    name: string;
    isActive: boolean;
    mfaRequired: boolean;
    version: number;
    createdAt: string | Date;
  };
  members: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    role: string;
    isActive: boolean;
  }>;
  outlets: Array<{
    id: string;
    name: string;
    slug: string;
    publicId: string;
    currency: string;
    timezone: string;
    outletType: string;
    fulfillmentModes: string[];
    isActive: boolean;
    isPublished: boolean;
    createdAt: string | Date;
  }>;
  brands: Array<{
    id: string;
    name: string;
  }>;
  entitlements: Array<{
    id: string;
    capability: string;
    billingCurrency: string;
    startsAt: string | Date;
    endsAt: string | Date;
  }>;
}

interface OrgsConsoleProps {
  organizations: OrgRow[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
  onFetchDetails: (orgId: string) => Promise<OrgDetailPayload>;
  onSetActive: (orgId: string, isActive: boolean, reason: string) => Promise<any>;
  onSetMfaRequired: (orgId: string, required: boolean) => Promise<any>;
  onEnterDiagnostic: (orgId: string) => Promise<any>;
}

export function OrgsConsole({
  organizations,
  total,
  page,
  totalPages,
  search: initialSearch,
  onFetchDetails,
  onSetActive,
  onSetMfaRequired,
  onEnterDiagnostic,
}: OrgsConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [selectedOrg, setSelectedOrg] = useState<OrgDetailPayload | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams?.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    startTransition(() => {
      router.push(`/admin/organizations?${params.toString()}`);
    });
  }

  async function openOrgDetails(orgId: string) {
    setActionMessage(null);
    try {
      const details = await onFetchDetails(orgId);
      setSelectedOrg(details);
    } catch (err: any) {
      setActionMessage({ text: err.message || "Failed to load details", type: "error" });
    }
  }

  async function handleToggleActive(isActive: boolean) {
    if (!selectedOrg) return;
    if (!suspendReason.trim() || suspendReason.trim().length < 5) {
      setActionMessage({ text: "Please provide a valid reason (min 5 chars)", type: "error" });
      return;
    }

    try {
      await onSetActive(selectedOrg.organization.id, isActive, suspendReason);
      setSelectedOrg({
        ...selectedOrg,
        organization: { ...selectedOrg.organization, isActive },
      });
      setShowSuspendPrompt(false);
      setSuspendReason("");
      setActionMessage({
        text: `Organization ${isActive ? "reactivated" : "suspended"} successfully.`,
        type: "success",
      });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Action failed", type: "error" });
    }
  }

  async function handleToggleMfa(mfaRequired: boolean) {
    if (!selectedOrg) return;
    try {
      await onSetMfaRequired(selectedOrg.organization.id, mfaRequired);
      setSelectedOrg({
        ...selectedOrg,
        organization: { ...selectedOrg.organization, mfaRequired },
      });
      setActionMessage({ text: `MFA enforcement set to ${mfaRequired}`, type: "success" });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "MFA update failed", type: "error" });
    }
  }

  async function handleDiagnosticView() {
    if (!selectedOrg) return;
    try {
      await onEnterDiagnostic(selectedOrg.organization.id);
      router.push("/dashboard");
    } catch (err: any) {
      setActionMessage({ text: err.message || "Failed to enter diagnostic mode", type: "error" });
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by organization name..."
              className="w-full rounded-xl border border-stone-800 bg-stone-900 py-2 pl-9 pr-4 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-orange-500"
          >
            Search
          </button>
        </form>

        <span className="text-xs text-stone-400">
          Showing <strong className="text-white">{organizations.length}</strong> of <strong className="text-white">{total}</strong> organizations
        </span>
      </div>

      {/* Organizations Table */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Status</th>
                <th className="p-3">MFA Policy</th>
                <th className="p-3">Outlets</th>
                <th className="p-3">Members</th>
                <th className="p-3">Version</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-sans text-xs">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-stone-500">
                    No organizations match your query.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-stone-800/40">
                    <td className="p-3">
                      <div className="font-semibold text-white">{org.name}</div>
                      <div className="font-mono text-[10px] text-stone-500">{org.id}</div>
                    </td>
                    <td className="p-3">
                      {org.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-900">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-red-950/60 px-2 py-0.5 text-[10px] font-medium text-red-400 border border-red-900">
                          <AlertTriangle className="h-3 w-3" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {org.mfaRequired ? (
                        <span className="text-[11px] font-medium text-emerald-400">Enforced</span>
                      ) : (
                        <span className="text-[11px] text-stone-500">Optional</span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-semibold text-stone-300">{org.outletCount}</td>
                    <td className="p-3 font-mono font-semibold text-stone-300">{org.memberCount}</td>
                    <td className="p-3 font-mono text-purple-400">v{org.version}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openOrgDetails(org.id)}
                        className="inline-flex items-center gap-1 rounded bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200 transition hover:bg-stone-700 hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-stone-800 pt-3 text-xs text-stone-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => {
                  const p = new URLSearchParams(searchParams?.toString());
                  p.set("page", String(page - 1));
                  router.push(`/admin/organizations?${p.toString()}`);
                }}
                className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => {
                  const p = new URLSearchParams(searchParams?.toString());
                  p.set("page", String(page + 1));
                  router.push(`/admin/organizations?${p.toString()}`);
                }}
                className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Organization Detail Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{selectedOrg.organization.name}</h2>
                  <span className="font-mono text-xs text-purple-400 font-semibold">
                    v{selectedOrg.organization.version}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-stone-400">ID: {selectedOrg.organization.id}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedOrg(null);
                  setShowSuspendPrompt(false);
                }}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Notification message */}
            {actionMessage && (
              <div
                className={`mt-4 rounded-lg p-3 text-xs font-medium ${
                  actionMessage.type === "success"
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                    : "bg-red-950 text-red-300 border border-red-800"
                }`}
              >
                {actionMessage.text}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-4 rounded-xl border border-stone-800 bg-stone-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {/* Enter Diagnostic Mode Button */}
                  <button
                    onClick={handleDiagnosticView}
                    className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-orange-500 shadow"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>View as Organization (Diagnostic Mode)</span>
                  </button>

                  {/* Toggle MFA policy */}
                  <button
                    onClick={() => handleToggleMfa(!selectedOrg.organization.mfaRequired)}
                    className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-stone-700"
                  >
                    <Shield className="h-3.5 w-3.5 text-stone-400" />
                    <span>{selectedOrg.organization.mfaRequired ? "Disable MFA Requirement" : "Enforce MFA"}</span>
                  </button>

                  {/* Suspend / Reactivate trigger */}
                  {selectedOrg.organization.isActive ? (
                    <button
                      onClick={() => setShowSuspendPrompt(true)}
                      className="rounded-lg border border-red-800 bg-red-950/60 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/60"
                    >
                      Suspend Organization
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSuspendReason("Operator reactivation");
                        handleToggleActive(true);
                      }}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      Reactivate Organization
                    </button>
                  )}
                </div>
              </div>

              {/* Suspend confirmation prompt */}
              {showSuspendPrompt && (
                <div className="mt-4 rounded-lg border border-red-800/80 bg-red-950/40 p-3 text-xs">
                  <p className="font-semibold text-red-300">
                    Are you sure you want to suspend this organization? Staff and public ordering will be disabled.
                  </p>
                  <input
                    type="text"
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="Enter reason for suspension (required, min 5 chars)..."
                    className="mt-2 w-full rounded border border-red-900 bg-stone-900 p-2 text-xs text-white placeholder-stone-500 focus:outline-none"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleToggleActive(false)}
                      className="rounded bg-red-700 px-3 py-1 font-semibold text-white hover:bg-red-600"
                    >
                      Confirm Suspension
                    </button>
                    <button
                      onClick={() => setShowSuspendPrompt(false)}
                      className="rounded border border-stone-700 px-3 py-1 text-stone-300 hover:bg-stone-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Outlets & Physical locations */}
            <div className="mt-5 space-y-4 text-xs">
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                  <Store className="h-4 w-4 text-orange-400" />
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Outlets ({selectedOrg.outlets.length})
                  </h3>
                </div>
                {selectedOrg.outlets.length === 0 ? (
                  <p className="mt-2 text-stone-500">No outlets registered.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {selectedOrg.outlets.map((out) => (
                      <div
                        key={out.id}
                        className="flex items-center justify-between rounded-lg border border-stone-800 bg-stone-900 p-3"
                      >
                        <div>
                          <div className="font-semibold text-white">{out.name}</div>
                          <div className="flex items-center gap-2 font-mono text-[10px] text-stone-400">
                            <span>Currency: {out.currency}</span>
                            <span>•</span>
                            <span>Type: {out.outletType}</span>
                            <span>•</span>
                            <span>Timezone: {out.timezone}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-300">
                            {out.fulfillmentModes?.join(", ") || "dine_in"}
                          </span>
                          {out.isPublished ? (
                            <span className="rounded bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-800">
                              Published
                            </span>
                          ) : (
                            <span className="rounded bg-stone-800 px-2 py-0.5 text-[10px] text-stone-500">
                              Draft
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Members */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  <h3 className="font-bold text-white uppercase tracking-wider text-[11px]">
                    Members & Roles ({selectedOrg.members.length})
                  </h3>
                </div>
                <div className="mt-3 divide-y divide-stone-800">
                  {selectedOrg.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-semibold text-white">{m.userName}</span>
                        <span className="ml-2 font-mono text-[10px] text-stone-400">{m.userEmail}</span>
                      </div>
                      <span className="rounded bg-stone-800 px-2 py-0.5 text-[10px] font-semibold text-purple-400 capitalize border border-stone-700">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
