"use client";

import { AdminDialog } from "../admin-dialog";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, CheckCircle2, AlertTriangle, Eye, X, Store, Users, Shield } from "lucide-react";

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
}: OrgsConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [selectedOrg, setSelectedOrg] = useState<OrgDetailPayload | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [showSuspendPrompt, setShowSuspendPrompt] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

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

  async function handleToggleActive(isActive: boolean, reasonOverride?: string) {
    if (!selectedOrg || actionBusy) return;
    const submittedReason = (reasonOverride ?? suspendReason).trim();
    if (submittedReason.length < 5) {
      setActionMessage({ text: "Please provide a valid reason (min 5 chars)", type: "error" });
      return;
    }

    setActionBusy(true);
    try {
      await onSetActive(selectedOrg.organization.id, isActive, submittedReason);
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
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleMfa(mfaRequired: boolean) {
    if (!selectedOrg || actionBusy) return;
    setActionBusy(true);
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
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex max-w-md flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by organization name..."
              className="admin-input pl-9 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-orange-500"
          >
            Search
          </button>
        </form>

        <span className="text-xs text-stone-500 dark:text-stone-400">
          Showing{" "}
          <strong className="text-stone-900 dark:text-stone-100">{organizations.length}</strong> of{" "}
          <strong className="text-stone-900 dark:text-stone-100">{total}</strong> organizations
        </span>
      </div>

      {/* Organizations Table */}
      <div className="admin-card p-5">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
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
            <tbody className="divide-y divide-stone-200 font-sans text-xs dark:divide-stone-800">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-stone-500 dark:text-stone-400">
                    No organizations match your query.
                  </td>
                </tr>
              ) : (
                organizations.map((org) => (
                  <tr key={org.id}>
                    <td className="p-3">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {org.name}
                      </div>
                      <div className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                        {org.id}
                      </div>
                    </td>
                    <td className="p-3">
                      {org.isActive ? (
                        <span className="admin-badge admin-badge-success">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-danger">
                          <AlertTriangle className="h-3 w-3" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {org.mfaRequired ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Enforced
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          Optional
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-semibold text-stone-800 tabular-nums dark:text-stone-200">
                      {org.outletCount}
                    </td>
                    <td className="p-3 font-mono font-semibold text-stone-800 tabular-nums dark:text-stone-200">
                      {org.memberCount}
                    </td>
                    <td className="p-3 font-mono font-semibold text-purple-600 dark:text-purple-400">
                      v{org.version}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openOrgDetails(org.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
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
          <div className="mt-4 flex items-center justify-between border-t border-stone-200 pt-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const p = new URLSearchParams(searchParams?.toString());
                  p.set("page", String(page - 1));
                  router.push(`/admin/organizations?${p.toString()}`);
                }}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-stone-700 hover:bg-stone-50 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const p = new URLSearchParams(searchParams?.toString());
                  p.set("page", String(page + 1));
                  router.push(`/admin/organizations?${p.toString()}`);
                }}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-stone-700 hover:bg-stone-50 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!selectedOrg && actionMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {actionMessage.text}
        </p>
      )}

      {/* Organization Detail Modal */}
      {selectedOrg && (
        <AdminDialog
          title="Manage organization"
          busy={actionBusy}
          onClose={() => {
            setSelectedOrg(null);
            setShowSuspendPrompt(false);
          }}
          className="max-w-3xl p-6"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-stone-200 pb-4 dark:border-stone-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                  {selectedOrg.organization.name}
                </h2>
                <span className="font-mono text-xs font-semibold text-purple-600 dark:text-purple-400">
                  v{selectedOrg.organization.version}
                </span>
              </div>
              <p className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                ID: {selectedOrg.organization.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedOrg(null);
                setShowSuspendPrompt(false);
              }}
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Notification message */}
          {actionMessage && (
            <div
              className={`mt-4 rounded-lg p-3 text-xs font-medium ${
                actionMessage.type === "success"
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-300"
                  : "border border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {actionMessage.text}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {/* Toggle MFA policy */}
                <button
                  type="button"
                  onClick={() => void handleToggleMfa(!selectedOrg.organization.mfaRequired)}
                  disabled={actionBusy}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                >
                  <Shield className="h-3.5 w-3.5 text-stone-500 dark:text-stone-400" />
                  <span>
                    {selectedOrg.organization.mfaRequired
                      ? "Disable MFA Requirement"
                      : "Enforce MFA"}
                  </span>
                </button>

                {/* Suspend / Reactivate trigger */}
                {selectedOrg.organization.isActive ? (
                  <button
                    type="button"
                    onClick={() => setShowSuspendPrompt(true)}
                    disabled={actionBusy}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
                  >
                    Suspend Organization
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      void handleToggleActive(true, "Operator reactivation");
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500"
                  >
                    Reactivate Organization
                  </button>
                )}
              </div>
            </div>

            {/* Suspend confirmation prompt */}
            {showSuspendPrompt && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs dark:border-red-900/60 dark:bg-red-950/40">
                <p className="font-semibold text-red-800 dark:text-red-300">
                  Are you sure you want to suspend this organization? Staff and public ordering will
                  be disabled immediately.
                </p>
                <input
                  type="text"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Enter reason for suspension (required, min 5 chars)..."
                  className="admin-input mt-2"
                />
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleToggleActive(false)}
                    disabled={actionBusy}
                    className="rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white shadow-2xs hover:bg-red-500"
                  >
                    Confirm Suspension
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuspendPrompt(false)}
                    disabled={actionBusy}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Outlets & Physical locations */}
          <div className="mt-5 space-y-4 text-xs">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2 dark:border-stone-800">
                <Store className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <h3 className="font-display text-[11px] font-bold tracking-wider text-stone-800 uppercase dark:text-stone-200">
                  Outlets ({selectedOrg.outlets.length})
                </h3>
              </div>
              {selectedOrg.outlets.length === 0 ? (
                <p className="mt-2 text-stone-500 dark:text-stone-400">No outlets registered.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {selectedOrg.outlets.map((out) => (
                    <div
                      key={out.id}
                      className="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900"
                    >
                      <div>
                        <div className="font-semibold text-stone-900 dark:text-stone-100">
                          {out.name}
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">
                          <span>Currency: {out.currency}</span>
                          <span>•</span>
                          <span>Type: {out.outletType}</span>
                          <span>•</span>
                          <span>Timezone: {out.timezone}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                          {out.fulfillmentModes?.join(", ") || "dine_in"}
                        </span>
                        {out.isPublished ? (
                          <span className="admin-badge admin-badge-success">Published</span>
                        ) : (
                          <span className="admin-badge admin-badge-neutral">Draft</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Members */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
              <div className="flex items-center gap-2 border-b border-stone-200 pb-2 dark:border-stone-800">
                <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display text-[11px] font-bold tracking-wider text-stone-800 uppercase dark:text-stone-200">
                  Members & Roles ({selectedOrg.members.length})
                </h3>
              </div>
              <div className="mt-3 divide-y divide-stone-200 dark:divide-stone-800">
                {selectedOrg.members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 text-xs">
                    <div>
                      <span className="font-semibold text-stone-900 dark:text-stone-100">
                        {m.userName}
                      </span>
                      <span className="ml-2 font-mono text-[10px] text-stone-500 dark:text-stone-400">
                        {m.userEmail}
                      </span>
                    </div>
                    <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 capitalize dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
