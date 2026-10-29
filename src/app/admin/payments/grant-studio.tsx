"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  CircleHelp,
  Clock3,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  grantEndForPreset,
  grantOverlaps,
  grantPresetDetails,
  grantStatus,
  localDateTimeInput,
  type GrantPreset,
  type GrantStatus,
} from "@/modules/admin/grant-policy";
import type { GrantActionResult } from "@/modules/admin/grant-feedback";

export interface GrantRow {
  id: string;
  organizationId: string;
  organizationName: string;
  capability: string;
  billingCurrency: string;
  startsAt: Date | string;
  endsAt: Date | string;
  revokedAt: Date | string | null;
  operator: string;
  reason: string;
  createdAt: Date | string;
}
export interface GrantTarget {
  id: string;
  name: string;
  active: boolean;
  outlets: string[];
}
export type TargetSearchResult =
  { ok: true; targets: GrantTarget[] } | { ok: false; message: string };
export type GrantListResult =
  { ok: true; grants: GrantRow[]; total: number; page: number } | { ok: false; message: string };

interface GrantStudioProps {
  initialGrants: GrantRow[];
  initialTotal: number;
  onSearchTargets: (query: string) => Promise<TargetSearchResult>;
  onListGrants: (page: number, organizationId?: string) => Promise<GrantListResult>;
  onIssueGrant: (data: {
    organizationId: string;
    capability: "ordering.new" | "kitchen.new";
    billingCurrency: "USD" | "INR";
    startsAt: string;
    endsAt: string;
    reason: string;
  }) => Promise<GrantActionResult>;
  onRenewGrant: (data: {
    grantId: string;
    expectedEndsAt: string;
    newEndsAt: string;
    reason: string;
  }) => Promise<GrantActionResult>;
  onRevokeGrant: (id: string, reason: string) => Promise<GrantActionResult>;
}
const badgeClasses: Record<GrantStatus, string> = {
  active: "border-emerald-700/70 bg-emerald-950 text-emerald-300",
  expiring: "border-amber-700/70 bg-amber-950 text-amber-200",
  scheduled: "border-sky-700/70 bg-sky-950 text-sky-200",
  expired: "border-stone-700 bg-stone-800 text-stone-300",
  revoked: "border-red-900 bg-red-950 text-red-300",
};
const statusNames: Record<GrantStatus, string> = {
  active: "Active",
  expiring: "Expiring soon",
  scheduled: "Scheduled",
  expired: "Expired",
  revoked: "Revoked",
};
const formatDate = (date: Date | string) =>
  new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const capabilityName = (capability: string) =>
  capability === "ordering.new" ? "Online Ordering" : "Kitchen Pro";

export function GrantStudio({
  initialGrants,
  initialTotal,
  onSearchTargets,
  onListGrants,
  onIssueGrant,
  onRenewGrant,
  onRevokeGrant,
}: GrantStudioProps) {
  const router = useRouter();
  const triggerRef = useRef<HTMLElement | null>(null);
  const [grants, setGrants] = useState(initialGrants);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [filterOrg, setFilterOrg] = useState<GrantTarget | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [mode, setMode] = useState<"issue" | "renew" | "revoke" | null>(null);
  const [selected, setSelected] = useState<GrantTarget | null>(null);
  const [targetGrant, setTargetGrant] = useState<GrantRow | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [targets, setTargets] = useState<GrantTarget[]>([]);
  const [searching, setSearching] = useState(false);
  const [preset, setPreset] = useState<GrantPreset>("trial_30");
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [reason, setReason] = useState("");
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [selectedGrants, setSelectedGrants] = useState<GrantRow[]>([]);
  const [selectionCount, setSelectionCount] = useState(0);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fetchingHistory, setFetchingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyTargets, setHistoryTargets] = useState<GrantTarget[]>([]);
  const [searchingHistory, setSearchingHistory] = useState(false);

  function closeDialog() {
    if (busy) return;
    setMode(null);
    triggerRef.current?.focus();
    setPassword("");
    setTotp("");
    setError("");
    setTargetGrant(null);
  }
  function openIssue() {
    triggerRef.current = document.activeElement as HTMLElement;
    // Start immediately; the local datetime picker displays minute precision.
    const start = new Date();
    setStartAt(localDateTimeInput(start));
    setEndAt(localDateTimeInput(grantEndForPreset("trial_30", start)!));
    setPreset("trial_30");
    setSelected(null);
    setSelectedGrants([]);
    setSelectionCount(0);
    setTargets([]);
    setOrgSearch("");
    setReason("");
    setPaymentVerified(false);
    setError("");
    setNotice("");
    setPassword("");
    setTotp("");
    setMode("issue");
  }
  function changePreset(next: GrantPreset) {
    setPreset(next);
    const end = grantEndForPreset(next, new Date(startAt));
    if (end) setEndAt(localDateTimeInput(end));
    setPaymentVerified(false);
  }
  function changeStart(next: string) {
    setStartAt(next);
    const start = new Date(next);
    const end = grantEndForPreset(preset, start);
    if (end && Number.isFinite(end.getTime())) setEndAt(localDateTimeInput(end));
  }
  async function searchOrganizations(event: FormEvent) {
    event.preventDefault();
    if (orgSearch.trim().length < 2) {
      setError("Enter at least two characters from a restaurant or organization name.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const result = await onSearchTargets(orgSearch);
      if (!result.ok) throw new Error(result.message);
      setTargets(result.targets);
      if (!result.targets.length)
        setError("No matching organizations. Try another restaurant name.");
    } catch {
      setError("Organization search could not be completed. Please retry.");
    } finally {
      setSearching(false);
    }
  }
  async function selectOrganization(org: GrantTarget) {
    if (!org.active) return;
    setSelected(org);
    setTargets([]);
    setError("");
    try {
      const result = await onListGrants(1, org.id);
      if (!result.ok) throw new Error(result.message);
      setSelectedGrants(result.grants);
      setSelectionCount(result.total);
    } catch {
      setSelectedGrants([]);
      setSelectionCount(0);
      setError("Could not check existing grants. The server still prevents overlapping access.");
    }
  }
  async function loadHistory(nextPage: number, org: GrantTarget | null, append = false) {
    setFetchingHistory(true);
    setError("");
    try {
      const result = await onListGrants(nextPage, org?.id);
      if (!result.ok) throw new Error(result.message);
      setGrants((prior) => (append ? [...prior, ...result.grants] : result.grants));
      setTotal(result.total);
      setPage(nextPage);
      setFilterOrg(org);
    } catch {
      setNotice("Could not load grant history. Refresh and try again.");
    } finally {
      setFetchingHistory(false);
    }
  }
  function openAction(grant: GrantRow, action: "renew" | "revoke") {
    triggerRef.current = document.activeElement as HTMLElement;
    setTargetGrant(grant);
    setMode(action);
    setReason("");
    setPassword("");
    setTotp("");
    setError("");
    setNotice("");
    if (action === "renew") {
      setEndAt(localDateTimeInput(new Date(new Date(grant.endsAt).getTime() + 30 * 86400000)));
    }
  }
  async function confirmPrivilegedAction() {
    const response = await fetch("/api/security/step-up", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify({ password, code: totp }),
    });
    if (response.status === 429) throw new Error("Too many verification attempts. Try later.");
    if (response.status === 503) throw new Error("Verification is temporarily unavailable.");
    if (!response.ok)
      throw new Error("Password or authenticator code not accepted. Check both and retry.");
  }
  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (busy || !mode) return;
    setError("");
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 5 || trimmedReason.length > 420) {
      setError("Add an audit justification between 5 and 420 characters.");
      return;
    }
    if (!password || !/^\d{6}$/.test(totp)) {
      setError("Enter your current password and six-digit authenticator code.");
      return;
    }
    let issueStart = "";
    let issueEnd = "";
    if (mode === "issue") {
      if (!selected || !selected.active) {
        setError("Select an active organization from the search results.");
        return;
      }
      const start = new Date(startAt);
      const end = new Date(endAt);
      if (
        !Number.isFinite(start.getTime()) ||
        !Number.isFinite(end.getTime()) ||
        end <= start ||
        end <= new Date()
      ) {
        setError("The end date must be later than the start and in the future.");
        return;
      }
      if (preset === "paid" && !paymentVerified) {
        setError("Confirm that payment was verified outside MenuMinute first.");
        return;
      }
      issueStart = start.toISOString();
      issueEnd = end.toISOString();
      const collides = selectedGrants.some(
        (grant) =>
          grant.capability === "ordering.new" &&
          grantOverlaps({ startsAt: issueStart, endsAt: issueEnd }, grant)
      );
      if (collides) {
        setError(
          "An overlapping Online Ordering grant already exists. Extend the existing grant instead."
        );
        return;
      }
    }
    if (mode !== "issue" && !targetGrant) return;
    if (
      mode === "renew" &&
      targetGrant &&
      new Date(endAt).getTime() <= new Date(targetGrant.endsAt).getTime()
    ) {
      setError("Select an end time later than the existing grant expiry.");
      return;
    }
    setBusy(true);
    try {
      await confirmPrivilegedAction();
      // Credentials are never sent to a Server Action or stored beyond this dialog.
      setPassword("");
      setTotp("");
      let result: GrantActionResult;
      if (mode === "issue" && selected) {
        result = await onIssueGrant({
          organizationId: selected.id,
          capability: "ordering.new",
          billingCurrency: currency,
          startsAt: issueStart,
          endsAt: issueEnd,
          reason: grantPresetDetails[preset].label + ": " + trimmedReason,
        });
      } else if (mode === "renew" && targetGrant) {
        result = await onRenewGrant({
          grantId: targetGrant.id,
          expectedEndsAt: new Date(targetGrant.endsAt).toISOString(),
          newEndsAt: new Date(endAt).toISOString(),
          reason: trimmedReason,
        });
      } else if (mode === "revoke" && targetGrant) {
        result = await onRevokeGrant(targetGrant.id, trimmedReason);
      } else return;
      if (!result.ok) throw new Error(result.message);
      setMode(null);
      setTargetGrant(null);
      setNotice(
        mode === "issue"
          ? "Online Ordering access granted. The change is audited."
          : mode === "renew"
            ? "A non-overlapping renewal has been scheduled and audited."
            : "Grant revoked. Existing accepted orders remain governed by their normal workflow."
      );
      await loadHistory(1, filterOrg);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not confirm the change. Refresh history before retrying."
      );
    } finally {
      setPassword("");
      setTotp("");
      setBusy(false);
    }
  }

  async function searchHistory(event: FormEvent) {
    event.preventDefault();
    if (historySearch.trim().length < 2) {
      setNotice("Enter at least two characters to find grant history by restaurant name.");
      return;
    }
    setSearchingHistory(true);
    setNotice("");
    try {
      const result = await onSearchTargets(historySearch);
      if (!result.ok) throw new Error(result.message);
      setHistoryTargets(result.targets);
      if (!result.targets.length) setNotice("No organizations match that restaurant name.");
    } catch {
      setNotice("Could not search grant history. Retry the search.");
    } finally {
      setSearchingHistory(false);
    }
  }

  function dialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !busy) {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
      )
    ).filter((element) => element.getClientRects().length > 0);
    if (!controls.length) return;
    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === controls[controls.length - 1]) {
      event.preventDefault();
      controls[0]?.focus();
    }
  }

  const visible = grants.filter(
    (grant) => statusFilter === "all" || grantStatus(grant) === statusFilter
  );
  const expiringCount = grants.filter((grant) => grantStatus(grant) === "expiring").length;
  const overlaps =
    mode === "issue" &&
    selected &&
    Number.isFinite(new Date(startAt).getTime()) &&
    Number.isFinite(new Date(endAt).getTime()) &&
    selectedGrants.some(
      (grant) =>
        grant.capability === "ordering.new" &&
        grantOverlaps({ startsAt: startAt, endsAt: endAt }, grant)
    );

  return (
    <section className="space-y-6" aria-label="Feature access and grant administration">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[.18em] text-orange-400 uppercase">
            Operator access desk
          </p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
            Feature access & trials
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-stone-400">
            Manage commercial product access by organization. Employee roles and outlet permissions
            stay separate.
          </p>
        </div>
        <button
          type="button"
          onClick={openIssue}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-500"
        >
          <Plus size={18} aria-hidden="true" /> New access grant
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card border-orange-200 bg-gradient-to-br from-orange-50/60 to-white p-5 dark:border-orange-900/40 dark:from-stone-900 dark:to-orange-950/30">
          <div className="flex items-center gap-3">
            <UtensilsCrossed className="text-orange-600 dark:text-orange-400" aria-hidden="true" />
            <h3 className="font-display font-bold text-stone-900 dark:text-white">Online Ordering</h3>
            <span className="admin-badge admin-badge-success uppercase">
              Grantable
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
            Offer a trial, manually approved paid term, or launch incentive. Customers remain free
            to publish QR menus without this grant.
          </p>
        </div>
        <div className="admin-card border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-stone-900">
          <div className="flex items-center gap-3">
            <ChefHat className="text-amber-600 dark:text-amber-300" aria-hidden="true" />
            <h3 className="font-display font-bold text-stone-900 dark:text-white">Kitchen Pro</h3>
            <span className="admin-badge admin-badge-warning uppercase">
              Not yet available
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300">
            Commercial activation is blocked in PostgreSQL and at the outlet flag until the release
            gates are completed.
          </p>
          <details className="mt-3 text-xs text-stone-600 dark:text-stone-300">
            <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-200">
              Why is Kitchen Pro unavailable?
            </summary>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Independent security and accessibility review</li>
              <li>Multi-station correctness, failure and load validation</li>
              <li>Verified backups, restore, release identity and ERP coexistence</li>
              <li>Owner-approved test rollout and commercial policy</li>
            </ul>
            <a
              href="https://github.com/baba-dev/menuminute/blob/main/docs/kitchen-pro-e-h-readiness.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-amber-700 dark:text-amber-200 underline"
            >
              Release readiness checklist
            </a>
          </details>
        </div>
      </div>

      <details
        open
        className="admin-card p-5 text-sm text-stone-600 dark:text-stone-300"
      >
        <summary className="flex cursor-pointer items-center gap-2 font-display font-bold text-stone-900 dark:text-white">
          <CircleHelp size={18} className="text-orange-600 dark:text-orange-400" aria-hidden="true" /> Admin tips · 4 quick steps
        </summary>
        <ol className="mt-4 grid gap-3 text-xs leading-relaxed sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <strong className="block font-semibold text-orange-600 dark:text-orange-300">1 · Find the restaurant</strong> Search by
            outlet or organization name. The grant applies to the parent organization.
          </li>
          <li>
            <strong className="block font-semibold text-orange-600 dark:text-orange-300">2 · Choose a period</strong> Use a trial
            preset or set custom dates. Paid terms require separate payment verification.
          </li>
          <li>
            <strong className="block font-semibold text-orange-600 dark:text-orange-300">3 · Verify securely</strong> Enter your
            password and current authenticator code inside the dialog for each change.
          </li>
          <li>
            <strong className="block font-semibold text-orange-600 dark:text-orange-300">4 · Review access</strong> Audit history,
            watch expiring access, and schedule a non-overlapping renewal.
          </li>
        </ol>
      </details>

      <div className="admin-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-bold text-stone-900 dark:text-white">Grants &amp; history</h3>
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              {total} recorded grants{filterOrg ? " · " + filterOrg.name : ""}. Historical entries
              are preserved.
            </p>
            {expiringCount > 0 && (
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <Clock3 size={15} aria-hidden="true" /> {expiringCount} visible grants expire within
                seven days.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="grant-status-filter" className="text-xs font-semibold text-stone-600 dark:text-stone-300">
              Status
            </label>
            <select
              id="grant-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="admin-input p-2 text-xs"
            >
              <option value="all">All statuses</option>
              {Object.entries(statusNames).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
            {filterOrg && (
              <button
                type="button"
                onClick={() => void loadHistory(1, null)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
              >
                Clear organization filter
              </button>
            )}
            <button
              type="button"
              disabled={fetchingHistory}
              onClick={() => void loadHistory(1, filterOrg)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              Refresh
            </button>
          </div>
        </div>
        {notice && (
          <p
            role="status"
            className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            {notice}
          </p>
        )}
        <form onSubmit={(event) => void searchHistory(event)} className="mt-4 flex flex-wrap gap-2">
          <label htmlFor="grant-history-org-search" className="sr-only">
            Find grant history by restaurant or organization name
          </label>
          <input
            id="grant-history-org-search"
            type="search"
            maxLength={80}
            placeholder="Find history by restaurant name"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            className="admin-input min-w-0 flex-1 px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={searchingHistory}
            className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-orange-500 disabled:opacity-50"
          >
            Find
          </button>
        </form>
        {historyTargets.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label="Matching history organizations">
            {historyTargets.map((org) => (
              <button
                type="button"
                key={org.id}
                onClick={() => {
                  setHistoryTargets([]);
                  void loadHistory(1, org);
                }}
                className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200 dark:hover:bg-orange-950"
              >
                {org.name} {org.outlets.length > 0 ? "· " + org.outlets.slice(0, 2).join(", ") : ""}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-3">
          {visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
              No grants match the current view.
            </p>
          )}
          {visible.map((grant) => {
            const status = grantStatus(grant);
            return (
              <article
                key={grant.id}
                className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 shadow-2xs dark:border-stone-800 dark:bg-stone-950/70"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold text-stone-900 dark:text-white">{grant.organizationName}</strong>
                      <span
                        className={
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold " +
                          badgeClasses[status]
                        }
                      >
                        {statusNames[status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-semibold text-orange-600 dark:text-orange-300">
                      {capabilityName(grant.capability)}
                    </p>
                    <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                      {formatDate(grant.startsAt)} – {formatDate(grant.endsAt)} ·{" "}
                      {grant.billingCurrency}
                    </p>
                    <p className="mt-1 text-xs break-words text-stone-500 dark:text-stone-400">
                      By {grant.operator} · {grant.reason}
                    </p>
                    <p className="mt-1 font-mono text-[10px] break-all text-stone-400 dark:text-stone-500">
                      Grant {grant.id}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {(status === "active" || status === "expiring" || status === "scheduled") &&
                      grant.capability === "ordering.new" && (
                        <button
                          type="button"
                          onClick={() => openAction(grant, "renew")}
                          className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-800 hover:bg-orange-100 dark:border-orange-800 dark:bg-transparent dark:text-orange-200 dark:hover:bg-orange-950"
                        >
                          Extend
                        </button>
                      )}
                    {(status === "active" || status === "expiring" || status === "scheduled") && (
                      <button
                        type="button"
                        onClick={() => openAction(grant, "revoke")}
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 hover:bg-red-100 dark:border-red-900 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-950"
                      >
                        Revoke
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const org = {
                          id: grant.organizationId,
                          name: grant.organizationName,
                          active: true,
                          outlets: [],
                        };
                        void loadHistory(1, org);
                      }}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                    >
                      History
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
          <span>
            Showing {grants.length} of {total} grants. Status filters apply to loaded records.
          </span>
          {grants.length < total && (
            <button
              type="button"
              disabled={fetchingHistory}
              onClick={() => void loadHistory(page + 1, filterOrg, true)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 font-medium text-stone-700 shadow-2xs hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              {fetchingHistory ? "Loading…" : "Load more history"}
            </button>
          )}
        </div>
      </div>

      {mode && (
        <div className="admin-modal-backdrop overflow-y-auto">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="grant-dialog-title"
            onKeyDown={dialogKeyDown}
            className="admin-modal-content max-w-2xl p-5 sm:p-7"
          >
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4 dark:border-stone-800">
              <div>
                <p className="text-xs font-bold tracking-widest text-orange-600 dark:text-orange-400 uppercase">
                  Feature access
                </p>
                <h3 id="grant-dialog-title" className="font-display mt-1 text-xl font-extrabold text-stone-900 dark:text-white">
                  {mode === "issue"
                    ? "Grant Online Ordering access"
                    : mode === "renew"
                      ? "Extend access"
                      : "Revoke access"}
                </h3>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {mode === "issue"
                    ? "Choose a restaurant, period and verified administrative reason."
                    : mode === "renew"
                      ? "A successor grant starts exactly when the current grant expires; the original audit remains immutable."
                      : "Stop new paid work for this organization. Already accepted work is preserved."}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={closeDialog}
                aria-label="Close grant dialog"
                className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {mode === "issue" && (
              <div className="mt-5 space-y-5">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950/60">
                  <label htmlFor="grant-org-search" className="font-display text-sm font-bold text-stone-900 dark:text-white">
                    1. Find an organization by restaurant name
                  </label>
                  <form
                    onSubmit={(event) => void searchOrganizations(event)}
                    className="mt-2 flex gap-2"
                  >
                    <input
                      id="grant-org-search"
                      autoFocus
                      value={orgSearch}
                      onChange={(e) => setOrgSearch(e.target.value)}
                      placeholder="Search restaurant or organization"
                      maxLength={80}
                      autoComplete="off"
                      className="admin-input text-sm"
                    />
                    <button
                      type="submit"
                      disabled={searching}
                      className="rounded-lg bg-orange-600 px-4 text-sm font-bold text-white shadow-2xs hover:bg-orange-500 disabled:opacity-50"
                    >
                      <Search size={18} aria-label={searching ? "Searching" : "Search"} />
                    </button>
                  </form>
                  {targets.length > 0 && (
                    <div
                      role="listbox"
                      aria-label="Matching organizations"
                      className="mt-3 max-h-52 space-y-2 overflow-y-auto"
                    >
                      {targets.map((org) => (
                        <button
                          type="button"
                          key={org.id}
                          role="option"
                          aria-selected={selected?.id === org.id}
                          disabled={!org.active}
                          onClick={() => void selectOrganization(org)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white p-3 text-left text-xs text-stone-900 shadow-2xs hover:border-orange-500 disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:text-white dark:hover:border-orange-500"
                        >
                          <span>
                            <strong className="block text-sm">{org.name}</strong>
                            <span className="mt-1 block text-stone-500 dark:text-stone-400">
                              {org.outlets.join(", ") || "Organization match"}
                            </span>
                          </span>
                          <span>{org.active ? <ArrowRight size={16} /> : "Inactive"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selected && (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                      <CheckCircle2 size={17} /> Selected: {selected.name}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    Grants cover all outlets in the selected organization, not just one restaurant.
                  </p>
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-stone-900 dark:text-white">2. Choose a capability and preset</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-orange-300 bg-orange-50/70 p-3 text-xs dark:border-orange-700 dark:bg-orange-950/30">
                      <UtensilsCrossed className="mb-2 text-orange-600 dark:text-orange-300" size={20} />
                      <strong className="block text-sm text-stone-900 dark:text-white">Online Ordering</strong>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-300">Available for grants</span>
                    </div>
                    <div className="rounded-xl border border-stone-200 bg-stone-100/60 p-3 text-xs opacity-75 dark:border-stone-700 dark:bg-stone-950/40">
                      <ChefHat className="mb-2 text-amber-600 dark:text-amber-300" size={20} />
                      <strong className="block text-sm text-stone-900 dark:text-white">Kitchen Pro</strong>
                      <span className="text-amber-700 dark:text-amber-200">
                        Not yet available · release gates pending
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(Object.keys(grantPresetDetails) as GrantPreset[]).map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => changePreset(key)}
                        aria-pressed={preset === key}
                        className={
                          "rounded-lg border p-2 text-xs font-semibold " +
                          (preset === key
                            ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-200"
                            : "border-stone-300 text-stone-700 hover:border-stone-400 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-500")
                        }
                      >
                        {grantPresetDetails[key].label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    {grantPresetDetails[preset].description}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Billing currency
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as "USD" | "INR")}
                      className="admin-input mt-1"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Starts (your local time)
                    <input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => changeStart(e.target.value)}
                      className="admin-input mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Ends (your local time)
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => {
                        setEndAt(e.target.value);
                        setPreset("custom");
                      }}
                      className="admin-input mt-1"
                    />
                  </label>
                </div>
                {preset === "paid" && (
                  <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                    <input
                      type="checkbox"
                      checked={paymentVerified}
                      onChange={(e) => setPaymentVerified(e.target.checked)}
                      className="mt-0.5 accent-orange-600"
                    />
                    I verified the customer payment or approved invoice outside MenuMinute. This
                    action does not collect money.
                  </label>
                )}
                {selectionCount > selectedGrants.length && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                    More grants exist than are shown here; PostgreSQL will check all overlapping
                    windows.
                  </p>
                )}
                {overlaps && (
                  <p
                    role="alert"
                    className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  >
                    This organization already has overlapping Online Ordering access. Review history
                    or schedule an extension rather than issuing a duplicate grant.
                  </p>
                )}
              </div>
            )}

            {mode !== "issue" && targetGrant && (
              <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800 dark:border-stone-700 dark:bg-stone-950/60 dark:text-stone-200">
                <strong className="block font-semibold text-stone-900 dark:text-white">
                  {targetGrant.organizationName} · {capabilityName(targetGrant.capability)}
                </strong>
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                  Current window ends {formatDate(targetGrant.endsAt)}
                </p>
                {mode === "renew" && (
                  <label className="mt-4 block text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Renewal ends (your local time)
                    <input
                      type="datetime-local"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      className="admin-input mt-2"
                    />
                    <span className="mt-2 block font-normal text-stone-500 dark:text-stone-400">
                      The new grant starts at the old expiry, with no overlap or lost audit history.
                    </span>
                  </label>
                )}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={(event) => void submitAction(event)}>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                {mode === "issue" ? "3. Audit justification" : "Audit justification"}
                <textarea
                  value={reason}
                  autoFocus={mode !== "issue"}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={5}
                  maxLength={420}
                  rows={2}
                  required
                  placeholder="Document the approval, agreement or trial reason"
                  className="admin-input mt-2 resize-y text-sm"
                />
              </label>
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-4 dark:border-orange-900/50 dark:bg-stone-950/70">
                <div className="flex items-center gap-2 text-sm font-bold text-stone-900 dark:text-white">
                  <LockKeyhole size={17} className="text-orange-600 dark:text-orange-400" />
                  {mode === "issue" ? "4. " : ""}Confirm this privileged action
                </div>
                <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
                  Enter your account password and current six-digit authenticator code. Both are
                  verified through the existing protected security endpoint. The proof expires in
                  five minutes and works once.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Account password
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="admin-input mt-1"
                    />
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Authenticator code
                    <input
                      type="text"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoComplete="one-time-code"
                      value={totp}
                      onChange={(e) => setTotp(e.target.value)}
                      className="admin-input mt-1"
                    />
                  </label>
                </div>
              </div>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                >
                  {error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-3 border-t border-stone-200 pt-4 dark:border-stone-700">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={busy}
                  className="rounded-lg border border-stone-300 bg-white px-4 py-3 text-xs font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || Boolean(overlaps) || (mode === "issue" && !selected)}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-xs font-bold text-white shadow-2xs hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy
                    ? "Verifying and saving…"
                    : mode === "issue"
                      ? "Confirm & issue grant"
                      : mode === "renew"
                        ? "Verify & schedule renewal"
                        : "Verify & revoke grant"}
                  {!busy && <ShieldCheck size={16} aria-hidden="true" />}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
