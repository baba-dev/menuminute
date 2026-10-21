"use client";

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
  onToggleSuperAdmin: (userId: string, isSuperAdmin: boolean) => Promise<any>;
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
    if (!selectedUser) return;
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
    }
  }

  async function handleRevokeSessions() {
    if (!selectedUser) return;
    if (
      !confirm(
        `Revoke all active sessions for ${selectedUser.user.email}? They will be logged out immediately.`
      )
    )
      return;
    try {
      await onRevokeSessions(selectedUser.user.id);
      setSelectedUser({ ...selectedUser, sessions: [] });
      setActionMessage({ text: "All active sessions revoked successfully.", type: "success" });
      router.refresh();
    } catch (err: any) {
      setActionMessage({ text: err.message || "Revoke failed", type: "error" });
    }
  }

  async function handleUnlock2FA() {
    if (!selectedUser) return;
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
    }
  }

  async function handleToggleSuperAdmin(enable: boolean) {
    if (!selectedUser) return;
    if (
      !confirm(
        `Are you sure you want to ${enable ? "grant" : "revoke"} Superadmin privileges for ${selectedUser.user.email}?`
      )
    )
      return;
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
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <form onSubmit={handleSearchSubmit} className="flex max-w-md flex-1 items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-stone-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or user ID..."
              className="w-full rounded-xl border border-stone-800 bg-stone-900 py-2 pr-4 pl-9 text-xs text-white placeholder-stone-500 focus:border-orange-500 focus:outline-none"
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
          Showing <strong className="text-white">{users.length}</strong> of{" "}
          <strong className="text-white">{total}</strong> users
        </span>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Email Status</th>
                <th className="p-3">2FA</th>
                <th className="p-3">Role</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-sans text-xs">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-stone-500">
                    No users match your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-stone-800/40">
                    <td className="p-3">
                      <div className="font-semibold text-white">{u.name}</div>
                      <div className="font-mono text-[11px] text-stone-400">{u.email}</div>
                    </td>
                    <td className="p-3">
                      {u.emailVerified ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-900 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-900 bg-amber-950/60 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.twoFactorEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <ShieldCheck className="h-3.5 w-3.5" /> Enrolled
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-500">Disabled</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded border border-orange-800 bg-orange-950 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                          <ShieldAlert className="h-3 w-3" /> Superadmin
                        </span>
                      ) : (
                        <span className="text-[11px] text-stone-400">User</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-stone-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openUserDetails(u.id)}
                        className="inline-flex items-center gap-1 rounded bg-stone-800 px-2.5 py-1 text-[11px] font-semibold text-stone-200 transition hover:bg-stone-700 hover:text-white"
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
                  router.push(`/admin/users?${p.toString()}`);
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
                  router.push(`/admin/users?${p.toString()}`);
                }}
                className="rounded border border-stone-700 bg-stone-800 px-2.5 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Management Slide-over / Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-stone-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">{selectedUser.user.name}</h2>
                  {selectedUser.user.isSuperAdmin && (
                    <span className="rounded border border-orange-800 bg-orange-950 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                      Superadmin
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-stone-400">{selectedUser.user.email}</p>
                <p className="font-mono text-[10px] text-stone-500">ID: {selectedUser.user.id}</p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
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
                    ? "border border-emerald-800 bg-emerald-950 text-emerald-300"
                    : "border border-red-800 bg-red-950 text-red-300"
                }`}
              >
                {actionMessage.text}
              </div>
            )}

            {/* User Details Tabs / Sections */}
            <div className="mt-5 space-y-5 text-xs">
              {/* Account Controls */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <h3 className="text-[11px] font-bold tracking-wider text-stone-200 uppercase">
                  Administrative Actions
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedUser.user.emailVerified ? (
                    <button
                      onClick={() => handleToggleVerify(false)}
                      className="rounded border border-stone-700 bg-stone-800 px-3 py-1.5 font-semibold text-amber-400 hover:bg-stone-700"
                    >
                      Unverify Email
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleVerify(true)}
                      className="rounded bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600"
                    >
                      Mark Email Verified
                    </button>
                  )}

                  <button
                    onClick={handleRevokeSessions}
                    className="flex items-center gap-1 rounded border border-red-800 bg-red-900/60 px-3 py-1.5 font-semibold text-red-300 hover:bg-red-900"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Revoke All Sessions ({selectedUser.sessions.length})</span>
                  </button>

                  {selectedUser.twoFactor && (
                    <button
                      onClick={handleUnlock2FA}
                      className="flex items-center gap-1 rounded border border-blue-800 bg-blue-900/60 px-3 py-1.5 font-semibold text-blue-300 hover:bg-blue-900"
                    >
                      <Unlock className="h-3.5 w-3.5" />
                      <span>Clear 2FA Lockout</span>
                    </button>
                  )}

                  {selectedUser.user.isSuperAdmin ? (
                    <button
                      onClick={() => handleToggleSuperAdmin(false)}
                      className="rounded border border-stone-700 bg-stone-800 px-3 py-1.5 font-semibold text-stone-400 hover:bg-stone-700"
                    >
                      Revoke Superadmin Role
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleSuperAdmin(true)}
                      className="flex items-center gap-1 rounded bg-orange-600 px-3 py-1.5 font-semibold text-white hover:bg-orange-500"
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                      <span>Promote to Superadmin</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Organization Memberships */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <h3 className="text-[11px] font-bold tracking-wider text-stone-200 uppercase">
                  Tenant Memberships ({selectedUser.memberships.length})
                </h3>
                {selectedUser.memberships.length === 0 ? (
                  <p className="mt-2 text-stone-500">Not assigned to any organizations.</p>
                ) : (
                  <div className="mt-2 divide-y divide-stone-800">
                    {selectedUser.memberships.map((m) => (
                      <div key={m.membershipId} className="flex items-center justify-between py-2">
                        <div>
                          <span className="font-semibold text-white">{m.organizationName}</span>
                          <span className="ml-2 font-mono text-[10px] text-stone-500">
                            {m.organizationId}
                          </span>
                        </div>
                        <span className="rounded border border-stone-700 bg-stone-800 px-2 py-0.5 text-[10px] font-semibold text-purple-400 capitalize">
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Sessions */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4">
                <h3 className="text-[11px] font-bold tracking-wider text-stone-200 uppercase">
                  Active Sessions ({selectedUser.sessions.length})
                </h3>
                {selectedUser.sessions.length === 0 ? (
                  <p className="mt-2 text-stone-500">No active login sessions.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {selectedUser.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="rounded border border-stone-800 bg-stone-900 p-2.5 font-mono text-[11px]"
                      >
                        <div className="flex justify-between text-stone-300">
                          <span>IP: {s.ipAddress || "Unknown"}</span>
                          <span className="text-stone-500">
                            Expires: {new Date(s.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div
                          className="mt-1 truncate text-[10px] text-stone-500"
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
          </div>
        </div>
      )}
    </div>
  );
}
