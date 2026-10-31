"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Search,
  Send,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { AdminDialog } from "../admin-dialog";
import type { TicketDetail, TicketRow } from "@/modules/support/service";

type Status = TicketRow["status"];
type Priority = TicketRow["priority"];
type Counts = Record<Status | "all", number>;

const STATUS_LABEL: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting on operator",
  resolved: "Resolved",
  closed: "Closed",
};
const STATUS_TONE: Record<Status, string> = {
  open: "admin-badge-brand",
  in_progress: "admin-badge-warning",
  waiting: "admin-badge-neutral",
  resolved: "admin-badge-success",
  closed: "admin-badge-neutral",
};
const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};
const PRIORITY_DOT: Record<Priority, string> = {
  low: "bg-sky-400",
  normal: "bg-stone-400",
  high: "bg-orange-500",
  urgent: "bg-red-600",
};
const TABS: Array<{ key: "" | Status; label: string; count: keyof Counts }> = [
  { key: "", label: "All", count: "all" },
  { key: "open", label: "Open", count: "open" },
  { key: "in_progress", label: "In progress", count: "in_progress" },
  { key: "waiting", label: "Waiting", count: "waiting" },
  { key: "resolved", label: "Resolved", count: "resolved" },
  { key: "closed", label: "Closed", count: "closed" },
];

function ago(iso: string, now: number) {
  if (!now) return ""; // set after mount, so server and browser render identically
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function PriorityChip({ priority }: { priority: Priority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-700 dark:text-stone-300">
      <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[priority]}`} aria-hidden="true" />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
function StatusBadge({ status }: { status: Status }) {
  return <span className={`admin-badge ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function SupportConsole({
  tickets,
  counts,
  hasNext,
  page,
  filters,
  currentAdminId,
  onLoad,
  onUpdate,
  onReply,
  onArchive,
}: {
  tickets: TicketRow[];
  counts: Counts;
  hasNext: boolean;
  page: number;
  filters: { status: string; priority: string; q: string; archived: boolean };
  currentAdminId: string;
  onLoad: (id: string) => Promise<TicketDetail>;
  onUpdate: (
    id: string,
    patch: { status?: string; priority?: string; assign?: "me" | "none" }
  ) => Promise<TicketDetail>;
  onReply: (id: string, body: string, internal: boolean) => Promise<TicketDetail>;
  onArchive: (id: string, archive: boolean) => Promise<TicketDetail>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(filters.q);
  const [open, setOpen] = useState<TicketDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    threadEnd.current?.scrollIntoView({ block: "end" });
  }, [open?.messages.length]);

  function go(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params?.toString());
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    if (!("page" in next)) p.delete("page");
    startTransition(() => router.push(`/admin/support?${p.toString()}`));
  }

  async function show(id: string) {
    setNote(null);
    setDraft("");
    setInternal(false);
    try {
      setOpen(await onLoad(id));
    } catch (e) {
      setNote({
        text: e instanceof Error ? e.message : "Could not open that request.",
        tone: "error",
      });
    }
  }
  async function act(work: () => Promise<TicketDetail>, success: string) {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      setOpen(await work());
      setNote({ text: success, tone: "ok" });
      router.refresh();
    } catch (e) {
      setNote({
        text: e instanceof Error ? e.message : "That didn't save. Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!open || !draft.trim()) return;
    const body = draft;
    await act(() => onReply(open.id, body, internal), internal ? "Note added." : "Reply sent.");
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="tablist"
        aria-label="Filter by status"
      >
        {TABS.map((t) => {
          const active = filters.status === t.key;
          return (
            <button
              key={t.label}
              role="tab"
              aria-selected={active}
              onClick={() => go({ status: t.key || undefined })}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "border-orange-500/60 bg-orange-50 text-orange-800 dark:border-orange-400/40 dark:bg-orange-950/40 dark:text-orange-200"
                  : "border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-stone-900"
              }`}
            >
              {t.label}
              <span className="tabular-nums opacity-70">{counts[t.count]}</span>
            </button>
          );
        })}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          go({ q: q.trim() || undefined });
        }}
      >
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            className="admin-input"
            style={{ paddingLeft: "2.25rem" }}
            placeholder="Search subject, #number, person or restaurant"
            value={q}
            maxLength={80}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search support requests"
          />
        </div>
        <select
          className="admin-input !w-auto"
          value={filters.priority}
          aria-label="Filter by priority"
          onChange={(e) => go({ priority: e.target.value || undefined })}
        >
          <option value="">Any priority</option>
          {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
          <input
            type="checkbox"
            checked={filters.archived}
            onChange={(e) => go({ archived: e.target.checked ? "1" : undefined })}
          />
          Archived
        </label>
      </form>

      {tickets.length === 0 ? (
        <div className="admin-card flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Inbox className="h-8 w-8 text-stone-300 dark:text-stone-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
            {filters.q || filters.status || filters.priority
              ? "Nothing matches those filters"
              : "No support requests yet"}
          </p>
          <p className="max-w-sm text-xs text-stone-500 dark:text-stone-400">
            Requests appear here the moment an operator sends one from Ember.
          </p>
        </div>
      ) : (
        <ul className="admin-card divide-y divide-stone-100 overflow-hidden dark:divide-stone-800">
          {tickets.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => void show(t.id)}
                className="group grid w-full gap-x-4 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-stone-50 focus-visible:bg-stone-50 focus-visible:outline-none sm:grid-cols-[1fr_auto] dark:hover:bg-stone-900/60"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
                    #{t.number}
                  </span>
                  <span className="line-clamp-2 text-[13px] font-semibold text-stone-900 sm:truncate dark:text-stone-100">
                    {t.subject}
                  </span>
                </span>
                <span className="order-3 flex flex-wrap items-center gap-x-3 gap-y-1 sm:order-none sm:justify-self-end">
                  <PriorityChip priority={t.priority} />
                  <StatusBadge status={t.status} />
                </span>
                <span className="order-2 truncate text-[11.5px] text-stone-500 sm:order-none dark:text-stone-400">
                  {t.requesterName || t.requesterEmail} · {t.organizationName}
                  {t.outletName && t.outletName !== t.organizationName ? ` · ${t.outletName}` : ""}
                </span>
                <span className="order-4 text-[11px] text-stone-400 sm:order-none sm:justify-self-end">
                  {[t.assigneeName, ago(t.createdAt, now)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between text-xs text-stone-500">
          <button
            className="inline-flex items-center gap-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => go({ page: String(page - 1) })}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Newer
          </button>
          <span>Page {page}</span>
          <button
            className="inline-flex items-center gap-1 disabled:opacity-40"
            disabled={!hasNext}
            onClick={() => go({ page: String(page + 1) })}
          >
            Older <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {note && !open && (
        <p role="alert" className="text-xs text-red-600">
          {note.text}
        </p>
      )}

      {open && (
        <AdminDialog
          title={`Support request #${open.number}`}
          onClose={() => setOpen(null)}
          busy={busy}
          className="admin-support-panel w-[min(46rem,calc(100vw-1.5rem))]"
        >
          <div className="flex max-h-[88dvh] flex-col">
            <header className="space-y-2 border-b border-stone-200 p-5 dark:border-stone-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-stone-400 tabular-nums">
                  #{open.number}
                </span>
                <StatusBadge status={open.status} />
                <PriorityChip priority={open.priority} />
                {open.archived && <span className="admin-badge admin-badge-neutral">Archived</span>}
              </div>
              <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
                {open.subject}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {open.requesterName} · {open.requesterEmail} · {open.organizationName}
                {open.outletName ? ` (${open.outletName})` : ""} · {open.category} ·{" "}
                {ago(open.createdAt, now)}
              </p>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <div className="rounded-xl bg-stone-50 p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap text-stone-800 dark:bg-stone-950 dark:text-stone-200">
                {open.body}
              </div>
              {open.messages.map((m) => (
                <div
                  key={m.id}
                  className={`admin-support-message rounded-xl border p-3.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    m.internal
                      ? "border-dashed border-amber-300 bg-amber-50/60 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/20 dark:text-amber-100"
                      : "border-orange-200 bg-orange-50/60 text-stone-900 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-stone-100"
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    {m.internal
                      ? "Internal note · only admins see this"
                      : `Reply to operator · ${m.authorName}`}{" "}
                    · {ago(m.createdAt, now)}
                  </p>
                  {m.body}
                </div>
              ))}
              <div ref={threadEnd} />
            </div>

            <footer className="space-y-3 border-t border-stone-200 p-4 dark:border-stone-800">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="admin-input !w-auto"
                  aria-label="Status"
                  value={open.status}
                  disabled={busy}
                  onChange={(e) =>
                    void act(() => onUpdate(open.id, { status: e.target.value }), "Status updated.")
                  }
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
                <select
                  className="admin-input !w-auto"
                  aria-label="Priority"
                  value={open.priority}
                  disabled={busy}
                  onChange={(e) =>
                    void act(
                      () => onUpdate(open.id, { priority: e.target.value }),
                      "Priority updated."
                    )
                  }
                >
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
                {open.assigneeId === currentAdminId ? (
                  <button
                    className="admin-input inline-flex !w-auto items-center gap-1.5"
                    disabled={busy}
                    onClick={() =>
                      void act(() => onUpdate(open.id, { assign: "none" }), "Unassigned.")
                    }
                  >
                    <UserMinus className="h-3.5 w-3.5" /> Unassign
                  </button>
                ) : (
                  <button
                    className="admin-input inline-flex !w-auto items-center gap-1.5"
                    disabled={busy}
                    onClick={() =>
                      void act(() => onUpdate(open.id, { assign: "me" }), "Assigned to you.")
                    }
                  >
                    <UserCheck className="h-3.5 w-3.5" />{" "}
                    {open.assigneeName ? `Take over from ${open.assigneeName}` : "Assign to me"}
                  </button>
                )}
                <button
                  className="admin-input ml-auto inline-flex !w-auto items-center gap-1.5 text-stone-600"
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () => onArchive(open.id, !open.archived),
                      open.archived ? "Restored." : "Archived."
                    )
                  }
                >
                  {open.archived ? (
                    <ArchiveRestore className="h-3.5 w-3.5" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                  {open.archived ? "Restore" : "Archive"}
                </button>
              </div>
              <div className="space-y-2">
                <textarea
                  className="admin-input min-h-[5.5rem] resize-y"
                  placeholder={
                    internal
                      ? "Write an internal note (the operator will not see it)"
                      : "Write a reply the operator will see in Ember"
                  }
                  value={draft}
                  maxLength={4000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void send();
                  }}
                  aria-label="Reply"
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                    />
                    Internal note
                  </label>
                  <div className="flex items-center gap-3">
                    {note && (
                      <span
                        role="status"
                        className={`text-xs ${note.tone === "ok" ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {note.text}
                      </span>
                    )}
                    <button
                      className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                      disabled={busy || !draft.trim()}
                      onClick={() => void send()}
                    >
                      <Send className="h-3.5 w-3.5" /> {internal ? "Add note" : "Send reply"}
                    </button>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </AdminDialog>
      )}
    </div>
  );
}
