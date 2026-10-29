"use client";

import { AdminDialog } from "../admin-dialog";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Unlock,
  AlertTriangle,
  Eye,
  X,
} from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  isSuperAdmin: boolean;
  isDemoData: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface UserDetailPayload {
  user: UserRow;
  sessions: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    expiresAt: string | Date;
    createdAt: string | Date;
  }>;
  accounts: Array<{
    id: string;
    providerId: string;
    accountId: string;
    createdAt: string | Date;
  }>;
  memberships: Array<{
    membershipId: string;
    organizationId: string;
    organizationName: string;
    role: string;
    isActive: boolean;
  }>;
  twoFactor: {
    verified: boolean;
    failedVerificationCount: number;
    lockedUntil: string | Date | null;
  } | null;
}

interface UsersConsoleProps {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
  search: string;
  onFetchDetails: (userId: string) => Promise<UserDetailPayload>;
  onToggleVerification: (userId: string, verified: boolean) => Promise<any>;
  onRevokeSessions: (userId: string) => Promise<any>;
  onUnlockTwoFactor: (userId: string) => Promise<any>;
  onToggleSuperAdmin: (userId: string, enable: boolean) => Promise<any>;
}

export function UsersConsole({
  users,
  total,
  page,
  totalPages,
  search: initialSearch,
  onFetchDetails,
  onToggleVerification,
  onRevokeSessions,
  onUnlockTwoFactor,
  onToggleSuperAdmin,
}: UsersConsoleProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(initialSearch);
  const [selectedUser, setSelectedUser] = useState<UserDetailPayload | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

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
      router.push(`/admin/users?${params.toString()}`);
    });
  }

  async function openUserDetails(userId: string) {
    setActionMessage(null);
    try {
      const details = await onFetchDetails(userId);
      setSelectedUser(details);
    } catch (err: any) {
      setActionMessage({ text: err.message || "Failed to load details", type: "error" });
    }
  }

  async function handleToggleVerify(verified: boolean) {
    if (!selectedUser || actionBusy) return;
    setActionBusy(true);
    try {
      await onToggleVerification(selectedUser.user.id, verified);
      setSelectedUser({
        ...selectedUser,
        user: { ...selectedUser.user, emailVerified: verified },
      });
      setActionMessage({ text: `Email verification updated to ${verified}`, type: "success" });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Action failed", type: "error" });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRevokeSessions() {
    if (!selectedUser || actionBusy) return;
    if (
      !confirm(
        `Revoke all active sessions for ${selectedUser.user.email}? They will be logged out immediately.`
      )
    )
      return;
    setActionBusy(true);
    try {
      await onRevokeSessions(selectedUser.user.id);
      setSelectedUser({ ...selectedUser, sessions: [] });
      setActionMessage({ text: "All active sessions revoked successfully.", type: "success" });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Revoke failed", type: "error" });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUnlock2FA() {
    if (!selectedUser || actionBusy) return;
    setActionBusy(true);
    try {
      await onUnlockTwoFactor(selectedUser.user.id);
      if (selectedUser.twoFactor) {
        setSelectedUser({
          ...selectedUser,
          twoFactor: { ...selectedUser.twoFactor, failedVerificationCount: 0, lockedUntil: null },
        });
      }
      setActionMessage({
        text: "Two-factor lockout and failed attempts cleared.",
        type: "success",
      });
    } catch (err: any) {
      setActionMessage({ text: err.message || "Unlock failed", type: "error" });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleSuperAdmin(enable: boolean) {
    if (!selectedUser || actionBusy) return;
    if (
      !confirm(
        `Are you sure you want to ${enable ? "grant" : "revoke"} Superadmin privileges for ${selectedUser.user.email}?`
      )
    )
      return;
    setActionBusy(true);
    try {
      await onToggleSuperAdmin(selectedUser.user.id, enable);
      setSelectedUser({
        ...selectedUser,
        user: { ...selectedUser.user, isSuperAdmin: enable },
      });
      setActionMessage({ text: `Superadmin status set to ${enable}`, type: "success" });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Action failed", type: "error" });
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
              placeholder="Search by name, email, or user ID..."
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
          Showing <strong className="text-stone-900 dark:text-stone-100">{users.length}</strong> of{" "}
          <strong className="text-stone-900 dark:text-stone-100">{total}</strong> users
        </span>
      </div>

      {/* Users Table */}
      <div className="admin-card p-5">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Email Status</th>
                <th className="p-3">2FA</th>
                <th className="p-3">Role</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 font-sans text-xs dark:divide-stone-800">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-500 dark:text-stone-400">
                    No users match your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="p-3">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {u.name}
                      </div>
                      <div className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                        {u.email}
                      </div>
                    </td>
                    <td className="p-3">
                      {u.emailVerified ? (
                        <span className="admin-badge admin-badge-success">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="admin-badge admin-badge-warning">
                          <AlertTriangle className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400 dark:text-stone-500">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.isSuperAdmin ? (
                        <span className="admin-badge admin-badge-brand">
                          <ShieldAlert className="h-3 w-3" /> Superadmin
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-600 dark:text-stone-400">User</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => openUserDetails(u.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Manage</span>
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
                  router.push(`/admin/users?${p.toString()}`);
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
                  router.push(`/admin/users?${p.toString()}`);
                }}
                className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-stone-700 hover:bg-stone-50 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {!selectedUser && actionMessage && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {actionMessage.text}
        </p>
      )}

      {/* User Management Modal */}
      {selectedUser && (
        <AdminDialog
          title="Manage user account"
          busy={actionBusy}
          onClose={() => setSelectedUser(null)}
          className="max-w-2xl p-6"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between border-b border-stone-200 pb-4 dark:border-stone-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                  {selectedUser.user.name}
                </h2>
                {selectedUser.user.isSuperAdmin && (
                  <span className="admin-badge admin-badge-brand">Superadmin</span>
                )}
              </div>
              <p className="font-mono text-xs text-stone-500 dark:text-stone-400">
                {selectedUser.user.email}
              </p>
              <p className="font-mono text-[10px] text-stone-400 dark:text-stone-500">
                ID: {selectedUser.user.id}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedUser(null)}
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

          {/* User Details Tabs / Sections */}
          <div className="mt-5 space-y-5 text-xs">
            {/* Account Controls */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
              <h3 className="text-[11px] font-bold tracking-wider text-stone-700 uppercase dark:text-stone-200">
                Administrative Actions
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedUser.user.emailVerified ? (
                  <button
                    type="button"
                    onClick={() => handleToggleVerify(false)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold text-amber-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-amber-400 dark:hover:bg-stone-700"
                  >
                    Unverify Email
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleVerify(true)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white shadow-2xs hover:bg-emerald-500"
                  >
                    Mark Email Verified
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRevokeSessions}
                  className="flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Revoke All Sessions ({selectedUser.sessions.length})</span>
                </button>

                {selectedUser.twoFactor && (
                  <button
                    type="button"
                    onClick={handleUnlock2FA}
                    className="flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-900/60"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    <span>Clear 2FA Lockout</span>
                  </button>
                )}

                {selectedUser.user.isSuperAdmin ? (
                  <button
                    type="button"
                    onClick={() => handleToggleSuperAdmin(false)}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-semibold text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
                  >
                    Revoke Superadmin Role
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleToggleSuperAdmin(true)}
                    className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 font-semibold text-white shadow-2xs hover:bg-orange-500"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Promote to Superadmin</span>
                  </button>
                )}
              </div>
            </div>

            {/* Organization Memberships */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
              <h3 className="text-[11px] font-bold tracking-wider text-stone-700 uppercase dark:text-stone-200">
                Tenant Memberships ({selectedUser.memberships.length})
              </h3>
              {selectedUser.memberships.length === 0 ? (
                <p className="mt-2 text-stone-500 dark:text-stone-400">
                  Not assigned to any organizations.
                </p>
              ) : (
                <div className="mt-2 divide-y divide-stone-200 dark:divide-stone-800">
                  {selectedUser.memberships.map((m) => (
                    <div key={m.membershipId} className="flex items-center justify-between py-2">
                      <div>
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {m.organizationName}
                        </span>
                        <span className="ml-2 font-mono text-[10px] text-stone-400 dark:text-stone-500">
                          {m.organizationId}
                        </span>
                      </div>
                      <span className="rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700 capitalize dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Sessions */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-950/60">
              <h3 className="text-[11px] font-bold tracking-wider text-stone-700 uppercase dark:text-stone-200">
                Active Sessions ({selectedUser.sessions.length})
              </h3>
              {selectedUser.sessions.length === 0 ? (
                <p className="mt-2 text-stone-500 dark:text-stone-400">No active login sessions.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {selectedUser.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg border border-stone-200 bg-white p-2.5 font-mono text-[11px] dark:border-stone-800 dark:bg-stone-900"
                    >
                      <div className="flex justify-between text-stone-700 dark:text-stone-300">
                        <span>IP: {s.ipAddress || "Unknown"}</span>
                        <span className="text-stone-400 dark:text-stone-500">
                          Expires: {new Date(s.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div
                        className="mt-1 truncate text-[10px] text-stone-500 dark:text-stone-400"
                        title={s.userAgent || ""}
                      >
                        UA: {s.userAgent || "Unknown"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
