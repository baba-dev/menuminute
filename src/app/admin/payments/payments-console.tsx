"use client";

import { AdminDialog } from "../admin-dialog";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import {
  GrantStudio,
  type GrantRow,
  type GrantListResult,
  type TargetSearchResult,
} from "./grant-studio";
import type { GrantActionResult } from "@/modules/admin/grant-feedback";

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

interface PaymentsConsoleProps {
  plans: Plan[];
  subscriptions: Subscription[];
  grants: GrantRow[];
  grantsTotal: number;
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
    term?: "trial_7" | "permanent";
  }) => Promise<GrantActionResult>;
  onRevokeGrant: (grantId: string, reason: string) => Promise<GrantActionResult>;
  onRenewGrant: (data: {
    grantId: string;
    expectedEndsAt: string;
    newEndsAt: string;
    reason: string;
  }) => Promise<GrantActionResult>;
  onSearchTargets: (query: string) => Promise<TargetSearchResult>;
  onListGrants: (page: number, organizationId?: string) => Promise<GrantListResult>;
}

export function PaymentsConsole({
  plans,
  subscriptions,
  grants,
  grantsTotal,
  financials,
  onUpdatePlan,
  onIssueGrant,
  onRevokeGrant,
  onRenewGrant,
  onSearchTargets,
  onListGrants,
}: PaymentsConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "entitlements" | "plans" | "subscriptions" | "analytics"
  >("entitlements");

  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Edit Plan State
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan || savingPlan) return;
    setSavingPlan(true);
    try {
      await onUpdatePlan(editingPlan.id, {
        displayName: editingPlan.displayName,
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
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-stone-200 dark:border-stone-800 text-xs font-semibold">
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

      {activeTab === "entitlements" && (
        <GrantStudio
          initialGrants={grants}
          initialTotal={grantsTotal}
          onSearchTargets={onSearchTargets}
          onListGrants={onListGrants}
          onIssueGrant={onIssueGrant}
          onRenewGrant={onRenewGrant}
          onRevokeGrant={onRevokeGrant}
        />
      )}

      {/* ─── TAB 2: Plans Catalog ─────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-white">Platform Subscription Tiers</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Manage plans, monthly prices in minor units (paise/cents), and feature bundles.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-stone-100 dark:bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-500 dark:text-stone-400 uppercase">
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

                  <h3 className="mt-2 text-base font-bold text-stone-900 dark:text-white">{p.displayName}</h3>
                  <div className="mt-1 flex items-baseline gap-1 text-2xl font-extrabold text-orange-400">
                    <span>₹{(p.monthlyPricePaise / 100).toFixed(0)}</span>
                    <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
                      / month ({p.monthlyPricePaise.toLocaleString()} paise)
                    </span>
                  </div>

                  <p className="mt-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                    Features: {p.features || "All basic features"}
                  </p>
                </div>

                <div className="mt-5 border-t border-stone-200 dark:border-stone-800 pt-3">
                  <button
                    onClick={() => setEditingPlan(p)}
                    className="w-full rounded-lg bg-stone-100 dark:bg-stone-800 py-1.5 text-xs font-semibold text-stone-200 transition hover:bg-stone-700"
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
            <h2 className="text-sm font-bold text-stone-900 dark:text-white">Active Tenant Subscriptions</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Subscriptions assigned to restaurant outlets across organizations.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700 dark:text-stone-300">
                <thead className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
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
                          <div className="font-semibold text-stone-900 dark:text-white">{s.restaurantName}</div>
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
                        <td className="p-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                          {s.currentPeriodStart
                            ? new Date(s.currentPeriodStart).toLocaleDateString()
                            : "—"}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
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
            <h2 className="text-sm font-bold text-stone-900 dark:text-white">Multi-Currency Financial Overview</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Orders transaction volume grouped strictly by local transaction currency (ADR 017
              invariant).
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {financials.byCurrency.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-6 text-center text-stone-500 sm:col-span-2">
                No orders recorded yet.
              </div>
            ) : (
              financials.byCurrency.map((fc) => (
                <div
                  key={fc.currency}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-5"
                >
                  <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-2">
                    <span className="font-mono text-sm font-bold text-orange-400">
                      {fc.currency} Orders
                    </span>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-4">
                    <span className="text-xs text-stone-500 dark:text-stone-400">Gross Merchandise Value (GMV)</span>
                    <div className="text-2xl font-extrabold text-stone-900 dark:text-white">
                      {(fc.totalMinor / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="text-xs font-normal text-stone-500 dark:text-stone-400">{fc.currency}</span>
                    </div>
                    <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                      Total Tickets: <strong className="text-stone-200">{fc.orderCount}</strong>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <AdminDialog title="Edit subscription plan" busy={savingPlan} onClose={() => setEditingPlan(null)} className="max-w-md p-6">
            <h2 className="text-base font-bold text-stone-900 dark:text-white">Edit Plan: {editingPlan.displayName}</h2>
            <form onSubmit={handleSavePlan} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 dark:text-stone-300">Display Name</label>
                <input
                  type="text"
                  required
                  value={editingPlan.displayName}
                  onChange={(e) => setEditingPlan({ ...editingPlan, displayName: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 p-2 text-stone-900 dark:text-white focus:outline-none"
                />
              </div>

              <div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Plan prices are read-only here. Price changes require a reviewed provider plan release.</p>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="planActive"
                  checked={editingPlan.isActive}
                  onChange={(e) => setEditingPlan({ ...editingPlan, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-stone-200 dark:border-stone-700 text-orange-600"
                />
                <label htmlFor="planActive" className="font-semibold text-stone-700 dark:text-stone-300">
                  Plan is Active and Selectable
                </label>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-stone-200 dark:border-stone-800 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  disabled={savingPlan}
                  className="rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-stone-700 dark:text-stone-300 hover:bg-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="rounded-lg bg-orange-600 px-4 py-1.5 font-semibold text-white hover:bg-orange-500"
                >
                  {savingPlan ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
        </AdminDialog>
      )}
    </div>
  );
}
