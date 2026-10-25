"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, TrendingUp } from "lucide-react";
import Link from "next/link";
import type { GrantActionResult } from "@/modules/admin/grant-feedback";

function localDateTimeInput(date: Date) {
  // datetime-local expects wall-clock local time, not a UTC ISO timestamp.
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

interface Plan {
  id: string;
  name: string;
  displayName: string;
  monthlyPricePaise: number;
  features: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Subscription {
  id: string;
  restaurantId: string;
  restaurantName: string;
  organizationId: string;
  planId: string;
  planName: string;
  status: string;
  currentPeriodStart: string | Date | null;
  currentPeriodEnd: string | Date | null;
  createdAt: string | Date;
}

interface Grant {
  id: string;
  organizationId: string;
  organizationName: string;
  capability: string;
  billingCurrency: string;
  startsAt: string | Date;
  endsAt: string | Date;
  revokedAt: string | Date | null;
  operator: string;
  reason: string;
  createdAt: string | Date;
}

interface PaymentsConsoleProps {
  plans: Plan[];
  subscriptions: Subscription[];
  grants: Grant[];
  financials: {
    byCurrency: Array<{ currency: string; orderCount: number; totalMinor: number }>;
    planSubscriptions: Array<{ planName: string; count: number }>;
  };
  onUpdatePlan: (planId: string, data: any) => Promise<any>;
  onIssueGrant: (data: {
    organizationId: string;
    capability: "ordering.new" | "kitchen.new";
    billingCurrency: "USD" | "INR";
    startsAt: string;
    endsAt: string;
    reason: string;
  }) => Promise<GrantActionResult>;
  onRevokeGrant: (grantId: string, reason: string) => Promise<any>;
}

export function PaymentsConsole({
  plans,
  subscriptions,
  grants,
  financials,
  onUpdatePlan,
  onIssueGrant,
  onRevokeGrant,
}: PaymentsConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "entitlements" | "plans" | "subscriptions" | "analytics"
  >("entitlements");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // New Grant Form State
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantOrgId, setGrantOrgId] = useState("");
  const [grantCapability, setGrantCapability] = useState<"ordering.new" | "kitchen.new">(
    "ordering.new"
  );
  const [grantCurrency, setGrantCurrency] = useState<"USD" | "INR">("INR");
  const [grantStartsAt, setGrantStartsAt] = useState("");
  const [grantEndsAt, setGrantEndsAt] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [isSubmittingGrant, setIsSubmittingGrant] = useState(false);

  // Edit Plan State
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  async function handleIssueGrant(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmittingGrant(true);
    setMessage(null);
    try {
      const result = await onIssueGrant({
        organizationId: grantOrgId.trim(),
        capability: grantCapability,
        billingCurrency: grantCurrency,
        startsAt: new Date(grantStartsAt).toISOString(),
        endsAt: new Date(grantEndsAt).toISOString(),
        reason: grantReason.trim(),
      });
      if (!result.ok) {
        setMessage({ text: result.message, type: "error" });
        return;
      }
      setMessage({ text: "Entitlement capability grant issued successfully.", type: "success" });
      setShowGrantModal(false);
      setGrantOrgId("");
      setGrantReason("");
      router.refresh();
    } catch {
      setMessage({
        text: "Could not confirm the grant. Refresh the grant list before retrying.",
        type: "error",
      });
    } finally {
      setIsSubmittingGrant(false);
    }
  }

  async function handleRevokeGrant(grantId: string) {
    const reason = prompt(
      "Enter justification reason for revoking this entitlement grant (min 5 chars):"
    );
    if (!reason || reason.trim().length < 5) {
      alert("Revocation reason is required (min 5 chars).");
      return;
    }
    try {
      await onRevokeGrant(grantId, reason.trim());
      setMessage({ text: "Entitlement grant revoked successfully.", type: "success" });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to revoke grant", type: "error" });
    }
  }

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      await onUpdatePlan(editingPlan.id, {
        displayName: editingPlan.displayName,
        monthlyPricePaise: Number(editingPlan.monthlyPricePaise),
        isActive: editingPlan.isActive,
        sortOrder: Number(editingPlan.sortOrder),
      });
      setMessage({
        text: `Plan ${editingPlan.displayName} updated successfully.`,
        type: "success",
      });
      setEditingPlan(null);
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update plan", type: "error" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-stone-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("entitlements")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "entitlements"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Operator Entitlements
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "plans"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Subscription Plans Catalog
        </button>
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "subscriptions"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Tenant Subscriptions
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "analytics"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Financial Overview
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-xs font-medium ${
            message.type === "success"
              ? "border border-emerald-800 bg-emerald-950 text-emerald-300"
              : "border border-red-800 bg-red-950 text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ─── TAB 1: Operator Entitlements ────────────────────────────────────────────── */}
      {activeTab === "entitlements" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Operator Entitlement Grants</h2>
              <p className="text-xs text-stone-400">
                Grant or revoke ordering/kitchen capabilities (USD or INR billing currency window).
              </p>
            </div>
            <button
              onClick={() => {
                const now = new Date();
                setGrantStartsAt(localDateTimeInput(now));
                setGrantEndsAt(
                  localDateTimeInput(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
                );
                setMessage(null);
                setShowGrantModal(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow transition hover:bg-orange-500"
            >
              <Plus className="h-4 w-4" />
              <span>Issue New Grant</span>
            </button>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
                  <tr>
                    <th className="p-3">Organization</th>
                    <th className="p-3">Capability</th>
                    <th className="p-3">Currency</th>
                    <th className="p-3">Window</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-sans text-xs">
                  {grants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-stone-500">
                        No entitlement grants issued.
                      </td>
                    </tr>
                  ) : (
                    grants.map((g) => {
                      const isExpired = new Date(g.endsAt) < new Date();
                      const isRevoked = Boolean(g.revokedAt);
                      const isActive = !isExpired && !isRevoked;

                      return (
                        <tr key={g.id} className="hover:bg-stone-800/40">
                          <td className="p-3">
                            <div className="font-semibold text-white">{g.organizationName}</div>
                            <div className="font-mono text-[10px] text-stone-500">
                              {g.organizationId}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-semibold text-orange-400">
                            {g.capability}
                          </td>
                          <td className="p-3 font-mono font-bold text-stone-300">
                            {g.billingCurrency}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-stone-400">
                            <div>From: {new Date(g.startsAt).toLocaleDateString()}</div>
                            <div>Until: {new Date(g.endsAt).toLocaleDateString()}</div>
                          </td>
                          <td className="p-3">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                                Active
                              </span>
                            ) : isRevoked ? (
                              <span className="inline-flex items-center gap-1 rounded border border-red-800 bg-red-950 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                                Revoked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-stone-800 px-2 py-0.5 text-[10px] text-stone-400">
                                Expired
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-mono text-[11px] text-stone-300">{g.operator}</div>
                            <div
                              className="max-w-xs truncate text-[10px] text-stone-500"
                              title={g.reason}
                            >
                              {g.reason}
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            {isActive && (
                              <button
                                onClick={() => handleRevokeGrant(g.id)}
                                className="rounded border border-red-800 bg-red-950/60 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-900"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Plans Catalog ─────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Platform Subscription Tiers</h2>
            <p className="text-xs text-stone-400">
              Manage plans, monthly prices in minor units (paise/cents), and feature bundles.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-800 bg-stone-900 p-5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-400 uppercase">
                      {p.name}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        p.isActive ? "text-emerald-400" : "text-stone-500"
                      }`}
                    >
                      {p.isActive ? "Active" : "Archived"}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-bold text-white">{p.displayName}</h3>
                  <div className="mt-1 flex items-baseline gap-1 text-2xl font-extrabold text-orange-400">
                    <span>{(p.monthlyPricePaise / 100).toFixed(0)}</span>
                    <span className="text-xs font-normal text-stone-400">minor units / mo</span>
                  </div>

                  <p className="mt-3 font-mono text-[11px] text-stone-400">
                    Features: {p.features || "All basic features"}
                  </p>
                </div>

                <div className="mt-5 border-t border-stone-800 pt-3">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="w-full rounded-lg bg-stone-800 py-1.5 text-xs font-semibold text-stone-200 transition hover:bg-stone-700"
                  >
                    Edit Plan Settings
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: Subscriptions ─────────────────────────────────────────────────── */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Active Tenant Subscriptions</h2>
            <p className="text-xs text-stone-400">
              Subscriptions assigned to restaurant outlets across organizations.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
                  <tr>
                    <th className="p-3">Restaurant Outlet</th>
                    <th className="p-3">Plan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Period Start</th>
                    <th className="p-3">Period End</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-sans text-xs">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-stone-500">
                        No subscriptions found.
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((s) => (
                      <tr key={s.id} className="hover:bg-stone-800/40">
                        <td className="p-3">
                          <div className="font-semibold text-white">{s.restaurantName}</div>
                          <div className="font-mono text-[10px] text-stone-500">
                            {s.restaurantId}
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-purple-400">{s.planName}</td>
                        <td className="p-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              s.status === "active"
                                ? "border border-emerald-800 bg-emerald-950 text-emerald-400"
                                : "bg-stone-800 text-stone-400"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-stone-400">
                          {s.currentPeriodStart
                            ? new Date(s.currentPeriodStart).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-stone-400">
                          {s.currentPeriodEnd
                            ? new Date(s.currentPeriodEnd).toLocaleDateString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: Financial Analytics ───────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white">Multi-Currency Financial Overview</h2>
            <p className="text-xs text-stone-400">
              Orders transaction volume grouped strictly by local transaction currency (ADR 017
              invariant).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {financials.byCurrency.length === 0 ? (
              <div className="rounded-2xl border border-stone-800 bg-stone-900 p-6 text-center text-stone-500 sm:col-span-2">
                No orders recorded yet.
              </div>
            ) : (
              financials.byCurrency.map((fc) => (
                <div
                  key={fc.currency}
                  className="rounded-2xl border border-stone-800 bg-stone-900 p-5"
                >
                  <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                    <span className="font-mono text-sm font-bold text-orange-400">
                      {fc.currency} Orders
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-stone-400">Gross Merchandise Value (GMV)</span>
                    <div className="text-2xl font-extrabold text-white">
                      {(fc.totalMinor / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs font-normal text-stone-400">{fc.currency}</span>
                    </div>
                    <div className="mt-2 text-xs text-stone-400">
                      Total Tickets: <strong className="text-stone-200">{fc.orderCount}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Issue Grant Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Issue Operator Entitlement Grant</h2>
            <p className="mt-1 text-xs text-stone-400">
              Grants new ordering or kitchen capabilities for a defined UTC window.
            </p>
            <p className="mt-2 text-xs text-amber-200">
              Each grant needs a fresh, single-use password and authenticator confirmation.{" "}
              <Link
                href="/account/security"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline underline-offset-2"
              >
                Confirm a privileged action
              </Link>{" "}
              in a new tab before submitting.
            </p>
            {message?.type === "error" && (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-red-800 bg-red-950 p-3 text-xs text-red-200"
              >
                {message.text}
              </p>
            )}

            <form onSubmit={handleIssueGrant} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300">Target Organization ID</label>
                <input
                  type="text"
                  required
                  value={grantOrgId}
                  onChange={(e) => setGrantOrgId(e.target.value)}
                  placeholder="e.g. org_abc123"
                  className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300">Capability</label>
                  <select
                    value={grantCapability}
                    onChange={(e) => setGrantCapability(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                  >
                    <option value="ordering.new">ordering.new</option>
                    <option value="kitchen.new" disabled>
                      kitchen.new — activation pending release gates
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-300">
                    Platform Billing Currency
                  </label>
                  <select
                    value={grantCurrency}
                    onChange={(e) => setGrantCurrency(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                  >
                    <option value="INR">INR (Platform)</option>
                    <option value="USD">USD (Platform)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-300">Starts At</label>
                  <input
                    type="datetime-local"
                    required
                    value={grantStartsAt}
                    onChange={(e) => setGrantStartsAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-stone-300">Ends At</label>
                  <input
                    type="datetime-local"
                    required
                    value={grantEndsAt}
                    onChange={(e) => setGrantEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-300">
                  Justification Reason (Audit Logged)
                </label>
                <input
                  type="text"
                  required
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  minLength={5}
                  maxLength={500}
                  placeholder="e.g. Approved launch pilot agreement #104"
                  className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-stone-800 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingGrant}
                  className="rounded-lg bg-orange-600 px-4 py-1.5 font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                >
                  {isSubmittingGrant ? "Issuing..." : "Confirm Grant"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white">Edit Plan: {editingPlan.displayName}</h2>
            <form onSubmit={handleSavePlan} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-300">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingPlan.displayName}
                  onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-300">
                  Monthly Price (Minor Units / Paise)
                </label>
                <input
                  type="number"
                  required
                  value={editingPlan.monthlyPricePaise}
                  onChange={(e) =>
                    setEditingPlan({
                      ...editingPlan,
                      monthlyPricePaise: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-stone-800 bg-stone-950 p-2 text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="planActive"
                  checked={editingPlan.isActive}
                  onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-700 text-orange-600"
                />
                <label htmlFor="planActive" className="font-semibold text-stone-300">
                  Plan is Active and Selectable
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-stone-800 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="rounded-lg border border-stone-700 px-3 py-1.5 text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-orange-600 px-4 py-1.5 font-semibold text-white hover:bg-orange-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
