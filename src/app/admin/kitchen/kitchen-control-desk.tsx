"use client";

import { useState, type FormEvent } from "react";
import { ChefHat, ShieldCheck, Search, AlertTriangle, RefreshCw, ExternalLink } from "lucide-react";
import type {
  KitchenPilotStatus,
  KitchenPilotTarget,
  PilotCommand,
} from "@/modules/kitchen/activation";

type SearchResult = { ok: true; outlets: KitchenPilotTarget[] } | { ok: false; message: string };
type StatusResult = { ok: true; status: KitchenPilotStatus } | { ok: false; message: string };
type Props = {
  operatorId: string;
  runningSha: string;
  onSearch: (term: string) => Promise<SearchResult>;
  onStatus: (outletId: string) => Promise<StatusResult>;
  onCommand: (input: PilotCommand) => Promise<StatusResult>;
};
type Action = "request" | "approve" | "activate" | "drain" | "finalize";

const names: Record<Action, string> = {
  request: "Request pilot review",
  approve: "Approve independent review",
  activate: "Activate approved pilot",
  drain: "Stop new intake / drain",
  finalize: "Finish drain / disable",
};
const stateCopy: Record<KitchenPilotStatus["state"], string> = {
  setup: "No pilot requested",
  requested: "Waiting for independent review",
  approved: "Pilot approved, awaiting activation",
  active: "Pilot running",
  draining: "Draining — finish existing tickets",
  disabled: "Disabled",
};

function ReadinessLine({ label, passed, note }: { label: string; passed: boolean; note: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 py-3 text-sm dark:border-stone-800">
      <span className="font-medium text-stone-700 dark:text-stone-200">{label}</span>
      <span className={passed ? "font-semibold text-emerald-600 dark:text-emerald-300" : "font-semibold text-amber-600 dark:text-amber-300"}>
        {passed ? "Verified" : "Blocked"} · {note}
      </span>
    </li>
  );
}

export function KitchenControlDesk({
  operatorId,
  runningSha,
  onSearch,
  onStatus,
  onCommand,
}: Props) {
  const [term, setTerm] = useState("");
  const [targets, setTargets] = useState<KitchenPilotTarget[]>([]);
  const [outlet, setOutlet] = useState<KitchenPilotTarget | null>(null);
  const [status, setStatus] = useState<KitchenPilotStatus | null>(null);
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [releaseSha, setReleaseSha] = useState(runningSha);
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [action, setAction] = useState<Action>("request");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function notice(text: string, error = false) {
    setMessage({ text, error });
  }
  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setTargets([]);
    try {
      const result = await onSearch(term);
      if (result.ok) {
        setTargets(result.outlets);
        if (!result.outlets.length) notice("No matching outlets found.");
      } else notice(result.message, true);
    } catch {
      notice("Search could not be confirmed.", true);
    } finally {
      setBusy(false);
    }
  }
  async function selectOutlet(target: KitchenPilotTarget) {
    setOutlet(target);
    setStatus(null);
    setTargets([]);
    setMessage(null);
    setBusy(true);
    try {
      const result = await onStatus(target.id);
      if (result.ok) {
        setStatus(result.status);
        setReleaseSha(result.status.releaseSha || runningSha);
        setEvidenceUrl(result.status.evidenceUrl || "");
      } else notice(result.message, true);
    } catch {
      notice("Unable to load outlet readiness.", true);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    if (!outlet) return;
    setBusy(true);
    try {
      const result = await onStatus(outlet.id);
      if (result.ok) {
        setStatus(result.status);
        notice("Current outlet state refreshed.");
      } else notice(result.message, true);
    } catch {
      notice("Unable to refresh readiness.", true);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!outlet || !status || busy) return;
    const selectedAction = actions.includes(action) ? action : (actions[0] ?? "request");
    setBusy(true);
    setMessage(null);
    try {
      const auth = await fetch("/api/security/step-up", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, code: totp }),
      });
      if (!auth.ok)
        throw new Error(
          auth.status === 429
            ? "Too many verification attempts."
            : auth.status === 503
              ? "Authentication service unavailable."
              : "Password and authenticator code not accepted."
        );
      const result = await onCommand({
        outletId: outlet.id,
        action: selectedAction,
        releaseSha,
        evidenceUrl,
        reason: reason.trim(),
        key: crypto.randomUUID(),
      });
      if (result.ok) {
        setStatus(result.status);
        setReason("");
        notice(names[selectedAction] + " completed and recorded in the audit ledger.");
      } else {
        notice(result.message, true);
      }
    } catch (error) {
      notice(error instanceof Error ? error.message : "Operation could not be confirmed.", true);
    } finally {
      setPassword("");
      setTotp("");
      setBusy(false);
    }
  }
  const actions: Action[] = !status
    ? []
    : status.state === "active"
      ? ["drain"]
      : status.state === "draining"
        ? ["finalize"]
        : status.state === "requested"
          ? ["approve", "request"]
          : status.state === "approved"
            ? ["activate", "request"]
            : ["request"];
  const ready =
    status &&
    status.configurationReady &&
    status.orderingEntitled &&
    status.openKitchenOrders === 0 &&
    runningSha === releaseSha;
  const selectedAction = actions.includes(action) ? action : (actions[0] ?? "request");
  const allowed =
    Boolean(status) &&
    (selectedAction === "activate"
      ? Boolean(ready && status?.state === "approved")
      : selectedAction === "approve"
        ? status?.state === "requested" && status.requestedBy !== operatorId
        : selectedAction === "drain"
          ? status?.state === "active"
          : selectedAction === "finalize"
            ? status?.state === "draining" && status.openKitchenOrders === 0
            : status?.state !== "active" && status?.state !== "draining");

  return (
    <div className="space-y-6">
      <header className="admin-card border-amber-200 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 p-6 dark:border-amber-900/50 dark:from-stone-900 dark:via-stone-900 dark:to-amber-950/30 sm:p-8">
        <div className="flex items-center gap-3 text-orange-600 dark:text-orange-400">
          <ChefHat size={24} aria-hidden="true" />
          <span className="text-xs font-bold tracking-[.2em] uppercase">
            Platform admin / Kitchen Pro
          </span>
        </div>
        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
          The Kitchen Control Desk
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-stone-300">
          Request a seven-day controlled outlet pilot. Separate superadmin review, live station
          checks, release identity and a one-use password + authenticator confirmation are required.
          Installing this feature never switches on customer kitchens automatically.
        </p>
      </header>

      <section className="admin-card p-5">
        <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">1 · Find an outlet</h2>
        <form onSubmit={(e) => void handleSearch(e)} className="mt-3 flex flex-wrap gap-2">
          <label htmlFor="kitchen-outlet-search" className="sr-only">
            Restaurant or organization
          </label>
          <input
            id="kitchen-outlet-search"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search restaurant or organization"
            minLength={2}
            maxLength={80}
            className="admin-input min-w-40 flex-1 text-sm"
          />
          <button
            disabled={busy || term.trim().length < 2}
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-500 disabled:opacity-40"
          >
            <Search size={16} /> Find
          </button>
        </form>
        {targets.length > 0 && (
          <ul
            className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
            aria-label="Matching outlets"
          >
            {targets.map((target) => (
              <li key={target.id} className="border-b border-stone-200 last:border-none dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => void selectOutlet(target)}
                  disabled={busy}
                  className="w-full p-3 text-left text-sm hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
                >
                  <strong className="block text-stone-900 dark:text-white">{target.name}</strong>
                  <span className="text-stone-500 dark:text-stone-400">{target.organizationName}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {outlet && (
          <p className="mt-3 text-sm font-semibold text-orange-600 dark:text-orange-400">
            Selected: {outlet.name} · {outlet.organizationName}
          </p>
        )}
      </section>

      {message && (
        <div
          role={message.error ? "alert" : "status"}
          className={
            message.error
              ? "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
              : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200"
          }
        >
          {message.text}
        </div>
      )}

      {status && (
        <>
          <section className="admin-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-800">
              <div>
                <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">
                  2 · Readiness &amp; release identity
                </h2>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {stateCopy[status.state]} · revision {status.revision}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refresh()}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700 disabled:opacity-40"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
            <ul className="mt-4">
              <ReadinessLine
                label="Active stations"
                passed={status.activeStations > 0}
                note={String(status.activeStations)}
              />
              <ReadinessLine
                label="Assigned staff"
                passed={status.assignedMembers > 0}
                note={String(status.assignedMembers)}
              />
              <ReadinessLine
                label="Unstaffed routed stations"
                passed={status.unmannedStations === 0}
                note={String(status.unmannedStations)}
              />
              <ReadinessLine
                label="Published dishes"
                passed={status.publishedDishes > 0}
                note={String(status.publishedDishes)}
              />
              <ReadinessLine
                label="Routes missing"
                passed={status.unroutedDishes === 0}
                note={String(status.unroutedDishes)}
              />
              <ReadinessLine
                label="Online ordering entitlement"
                passed={status.orderingEntitled}
                note={status.orderingEntitled ? "Active" : "Missing"}
              />
              <ReadinessLine
                label="Open Kitchen orders"
                passed={status.openKitchenOrders === 0}
                note={String(status.openKitchenOrders)}
              />
              <ReadinessLine
                label="Exact deployed release"
                passed={Boolean(runningSha && releaseSha === runningSha)}
                note={runningSha ? runningSha.slice(0, 12) : "Unavailable"}
              />
            </ul>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mr-2 inline" size={15} aria-hidden="true" />
              Independent security/accessibility review, off-host backup and restore, load/failure
              testing, shared ERP measurements and an operator-authorized rollout require external
              evidence. A GitHub link is an operator attestation, not automatic verification.
              <a
                className="ml-2 font-bold underline text-amber-950 dark:text-amber-200"
                href="https://github.com/baba-dev/menuminute/issues/76"
                rel="noreferrer"
                target="_blank"
              >
                QA tracker <ExternalLink size={12} className="inline" />
              </a>
            </div>
          </section>

          <section className="admin-card p-5">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3 dark:border-stone-800">
              <ShieldCheck className="text-orange-600 dark:text-orange-400" size={20} />
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-white">
                3 · Reviewed operator action
              </h2>
            </div>
            <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
              Requestor and approver must be different superadmins. Approval expires after 24 hours.
              Only one reviewed outlet may be activated per command; no public Kitchen subscription
              is unlocked.
            </p>
            <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-4">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Action
                <select
                  className="admin-input mt-1"
                  value={selectedAction}
                  onChange={(e) => setAction(e.target.value as Action)}
                >
                  {actions.map((item) => (
                    <option key={item} value={item}>
                      {names[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Full release SHA
                <input
                  value={releaseSha}
                  onChange={(e) => setReleaseSha(e.target.value)}
                  spellCheck={false}
                  placeholder="Exact 40-character Git SHA"
                  maxLength={40}
                  className="admin-input mt-1 font-mono text-xs"
                />
              </label>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                GitHub release evidence URL
                <input
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  type="url"
                  maxLength={500}
                  placeholder="https://github.com/baba-dev/menuminute/issues/76"
                  className="admin-input mt-1"
                />
              </label>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Operator justification
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Explain evidence reviewed and action justified"
                  className="admin-input mt-1 resize-y"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Account password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="admin-input mt-1"
                  />
                </label>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Authenticator code
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="one-time-code"
                    value={totp}
                    onChange={(e) => setTotp(e.target.value)}
                    required
                    maxLength={6}
                    className="admin-input mt-1"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={
                  busy ||
                  !allowed ||
                  reason.trim().length < 10 ||
                  !password ||
                  !/^\d{6}$/.test(totp)
                }
                className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-5 py-3 font-display font-bold text-white shadow-2xs hover:from-orange-500 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Verifying…" : names[selectedAction]}
              </button>
              {!allowed && (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300" role="note">
                  This action is not permitted in the current state. Refresh readiness or obtain
                  independent approval.
                </p>
              )}
            </form>
          </section>
        </>
      )}
    </div>
  );
}
