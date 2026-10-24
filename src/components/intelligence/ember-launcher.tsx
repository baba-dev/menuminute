"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { navigation, routesForEvidence, type RouteId } from "@/modules/intelligence/navigation";
import "./ember.css";

type StoredTurn = {
  id: string;
  prompt: string;
  answer: string | null;
  status: "processing" | "completed" | "failed";
  errorCode: string | null;
  evidence: unknown;
  createdAt: string;
};
type Conversation = { id: string; updatedAt: string };
type Choice = {
  id: string;
  name: string;
  revision: number;
  items: { id: string; name: string; category: string; soldOut: boolean }[];
};
type Proposal = {
  id: string;
  status: "pending" | "confirmed" | "rejected" | "stale";
  menuId: string;
  menuName: string;
  dishId: string;
  dishName: string;
  beforeSoldOut: boolean;
  desiredSoldOut: boolean;
  expectedRevision: number;
  expiresAt: string;
  result: unknown;
};
type Capabilities = {
  enabled: boolean;
  actionsEnabled: boolean;
  tools: string[];
  navigation: { id: RouteId; label: string; href: string }[];
};
const jsonHeaders = { "content-type": "application/json" } as const;
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin" });
  const body: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : "Request unsuccessful. Refresh and try again.";
    throw new Error(message);
  }
  return body as T;
}
function message(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}
export function EmberLauncher({
  organizationId,
  outletId,
  outletName,
}: {
  organizationId: string;
  outletId: string;
  outletName: string;
}) {
  const router = useRouter();
  const qs = new URLSearchParams({ organizationId, outletId }).toString();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<StoredTurn[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [options, setOptions] = useState<Choice[]>([]);
  const [actionOpen, setActionOpen] = useState(false);
  const [menuId, setMenuId] = useState("");
  const [dishId, setDishId] = useState("");
  const [desiredSoldOut, setDesiredSoldOut] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [acknowledged, setAcknowledged] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const decisionKeys = useRef(new Map<string, { key: string; decision: "confirm" | "reject" }>());
  const currentId = useRef<string | null>(null);
  const [pendingPoll, setPendingPoll] = useState(0);
  const currentMenu = options.find((m) => m.id === menuId);
  const currentDish = currentMenu?.items.find((i) => i.id === dishId);
  const scope = { organizationId, outletId };
  const getConversations = useCallback(async () => {
    const rows = await api<Conversation[]>("/api/assistant/conversations?" + qs);
    setConversations(rows);
    return rows;
  }, [qs]);
  const loadHistory = useCallback(
    async (id: string) => {
      const [data, actions] = await Promise.all([
        api<{ turns: StoredTurn[] }>(
          "/api/assistant/conversations/" + encodeURIComponent(id) + "?" + qs
        ),
        caps?.actionsEnabled
          ? api<Proposal[]>(
              "/api/assistant/conversations/" + encodeURIComponent(id) + "/actions?" + qs
            )
          : Promise.resolve([]),
      ]);
      if (currentId.current !== id) return;
      setTurns(data.turns);
      setProposals(actions);
      if (data.turns.some((t) => t.status === "processing")) setPendingPoll((n) => n + 1);
    },
    [qs, caps?.actionsEnabled]
  );
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await api<Capabilities>("/api/assistant/capabilities?" + qs);
        if (cancelled) return;
        setCaps(c);
        const rows = await getConversations();
        if (cancelled) return;
        if (rows[0]) {
          currentId.current = rows[0].id;
          setConversationId(rows[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, qs, getConversations]);
  useEffect(() => {
    if (!open || !conversationId) return;
    currentId.current = conversationId;
    const timeout = window.setTimeout(() => {
      void loadHistory(conversationId).catch((e) => setError(message(e)));
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [open, conversationId, loadHistory]);
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [open]);
  useEffect(() => {
    if (
      !open ||
      !conversationId ||
      !turns.some((t) => t.status === "processing") ||
      pendingPoll > 40
    )
      return;
    const id = window.setTimeout(
      () => void loadHistory(conversationId).catch((e) => setError(message(e))),
      3000
    );
    return () => window.clearTimeout(id);
  }, [open, conversationId, turns, pendingPoll, loadHistory]);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = old;
      before?.focus?.();
    };
  }, [open]);
  useEffect(() => {
    if (open) feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "auto" });
  }, [open, turns, proposals]);
  const openNew = async () => {
    if (busy) return null;
    setBusy(true);
    setError("");
    try {
      const row = await api<{ id: string }>("/api/assistant/conversations", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ ...scope, key: crypto.randomUUID() }),
      });
      currentId.current = row.id;
      setConversationId(row.id);
      setPendingPoll(0);
      setTurns([]);
      setProposals([]);
      setHistoryOpen(false);
      await getConversations();
      return row.id;
    } catch (e) {
      setError(message(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || value.length > 4000 || busy) return;
    setBusy(true);
    setError("");
    setStatus("Preparing a scoped answer…");
    let id = conversationId;
    try {
      if (!id) {
        const row = await api<{ id: string }>("/api/assistant/conversations", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ ...scope, key: crypto.randomUUID() }),
        });
        id = row.id;
        currentId.current = id;
        setConversationId(id);
        setPendingPoll(0);
        setTurns([]);
        setProposals([]);
      }
      const result = await api<{ status: string; errorCode?: string }>(
        "/api/assistant/conversations/" + encodeURIComponent(id) + "/turns",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ ...scope, prompt: value, key: crypto.randomUUID() }),
        }
      );
      setPrompt("");
      if (result.status === "failed")
        setError("Ember could not verify the answer. No business change occurred.");
      await loadHistory(id);
      await getConversations();
    } catch (e) {
      setError(
        message(e) +
          " The request may have been recorded; check History before submitting it again."
      );
      await (id ? loadHistory(id).catch(() => {}) : Promise.resolve());
    } finally {
      setBusy(false);
      setStatus("");
    }
  };
  const fetchOptions = async () => {
    setActionOpen(true);
    setError("");
    try {
      const rows = await api<Choice[]>("/api/assistant/availability?" + qs);
      setOptions(rows);
      if (!menuId && rows[0]) setMenuId(rows[0].id);
    } catch (e) {
      setError(message(e));
    }
  };
  const propose = async () => {
    if (
      !conversationId ||
      !menuId ||
      !dishId ||
      busy ||
      !currentDish ||
      currentDish.soldOut === desiredSoldOut
    )
      return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Proposal>("/api/assistant/actions", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          ...scope,
          conversationId,
          menuId,
          dishId,
          desiredSoldOut,
          key: crypto.randomUUID(),
        }),
      });
      setProposals((p) => [result, ...p.filter((x) => x.id !== result.id)]);
      setAcknowledged(null);
      setActionOpen(false);
    } catch (e) {
      setError(message(e) + " Check proposals before trying again.");
      await loadHistory(conversationId).catch(() => {});
    } finally {
      setBusy(false);
    }
  };
  const decide = async (p: Proposal, decision: "confirm" | "reject") => {
    if (!conversationId || busy || p.status !== "pending") return;
    setBusy(true);
    setError("");
    const previousDecision = decisionKeys.current.get(p.id);
    const key =
      previousDecision?.decision === decision ? previousDecision.key : crypto.randomUUID();
    decisionKeys.current.set(p.id, { key, decision });
    try {
      const result = await api<{ id: string; status: Proposal["status"]; message?: string }>(
        "/api/assistant/actions/" + encodeURIComponent(p.id),
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ ...scope, key, decision }),
        }
      );
      setProposals((rows) =>
        rows.map((row) => (row.id === p.id ? { ...row, status: result.status, result } : row))
      );
      setAcknowledged(null);
      setStatus(
        result.status === "confirmed"
          ? "Availability change saved."
          : (result.message ?? "No change was made.")
      );
      if (result.status === "confirmed") router.refresh();
    } catch (e) {
      setError(
        message(e) +
          " The outcome is uncertain; review the durable proposal before taking another action."
      );
      await loadHistory(conversationId).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="mm-ember-launch"
        onClick={() => {
          setNow(Date.now());
          setOpen(true);
          setError("");
        }}
        aria-label="Open Ember assistant"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>Ask Ember</span>
      </button>
      {open && (
        <div className="mm-ember-layer">
          <button
            type="button"
            aria-label="Close Ember"
            className="mm-ember-backdrop"
            onClick={() => setOpen(false)}
          />
          <section
            className="mm-ember-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mm-ember-title"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                setOpen(false);
                return;
              }
              if (event.key !== "Tab") return;
              const nodes = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not([disabled]),a[href],textarea:not([disabled]),input:not([disabled]),select:not([disabled])"
                )
              ).filter((n) => n.getClientRects().length > 0);
              if (!nodes.length) return;
              const first = nodes[0]!,
                last = nodes[nodes.length - 1]!;
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
              }
            }}
          >
            <header className="mm-ember-head">
              <div className="mm-ember-mark" aria-hidden="true">
                <Sparkles size={21} />
              </div>
              <div className="mm-ember-head-copy">
                <span className="mm-ember-overline">MENUMINUTE INTELLIGENCE</span>
                <h2 id="mm-ember-title">
                  Ember <span>· your service companion</span>
                </h2>
                <p title={outletName}>For {outletName}</p>
              </div>
              <button
                type="button"
                className="mm-ember-icon"
                ref={closeRef}
                aria-label="Close assistant"
                onClick={() => setOpen(false)}
              >
                <X size={21} />
              </button>
            </header>
            <div className="mm-ember-toolbar">
              <button type="button" onClick={() => void openNew()} disabled={busy}>
                <Plus size={16} /> New chat
              </button>
              <button
                type="button"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((v) => !v)}
              >
                <Clock3 size={16} /> History <ChevronDown size={13} />
              </button>
              {caps?.actionsEnabled && (
                <button
                  type="button"
                  aria-expanded={actionOpen}
                  onClick={() => void fetchOptions()}
                  disabled={busy || !conversationId}
                >
                  <ShieldCheck size={16} /> Actions
                </button>
              )}
            </div>
            {historyOpen && (
              <nav aria-label="Ember conversation history" className="mm-ember-history">
                {conversations.length === 0 ? (
                  <p>No conversations yet.</p>
                ) : (
                  conversations.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      aria-current={c.id === conversationId ? "true" : undefined}
                      onClick={() => {
                        currentId.current = c.id;
                        setConversationId(c.id);
                        setPendingPoll(0);
                        setHistoryOpen(false);
                        setError("");
                      }}
                    >
                      {new Date(c.updatedAt).toLocaleString()} <ArrowRight size={14} />
                    </button>
                  ))
                )}
              </nav>
            )}
            <div
              className="mm-ember-feed"
              ref={feedRef}
              role="log"
              aria-label="Conversation"
              aria-live="polite"
              aria-relevant="additions"
            >
              {!turns.length && !proposals.length && (
                <div className="mm-ember-welcome">
                  <div className="mm-ember-welcome-mark">
                    <Sparkles size={29} />
                  </div>
                  <span className="mm-ember-overline">A BETTER VIEW OF YOUR DAY</span>
                  <h3>Clarity, served warm.</h3>
                  <p>
                    Ask about your orders, published menu, or kitchen activity. Ember uses your
                    current outlet permissions and labels its sources.
                  </p>
                  <div className="mm-ember-suggestions">
                    {[
                      "How is my order queue looking?",
                      "Show recent completed orders",
                      "Summarize my menus",
                    ].map((question) => (
                      <button key={question} type="button" onClick={() => setPrompt(question)}>
                        {question}
                        <ArrowRight size={14} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {turns.map((t) => (
                <article key={t.id} className="mm-ember-exchange">
                  <div className="mm-ember-human">
                    <span>You</span>
                    <p>{t.prompt}</p>
                  </div>
                  <div className="mm-ember-answer">
                    <span>
                      <Sparkles size={15} /> Ember
                    </span>
                    {t.status === "processing" ? (
                      <p>
                        <LoaderCircle size={16} className="mm-ember-spin" /> Checking authorized
                        sources…
                      </p>
                    ) : t.status === "failed" ? (
                      <p role="status">
                        Unable to verify this answer ({t.errorCode ?? "processing_failed"}). No
                        business action was taken.
                      </p>
                    ) : (
                      <p>{t.answer}</p>
                    )}
                    {Array.isArray(t.evidence) && t.evidence.length > 0 && (
                      <details className="mm-ember-evidence">
                        <summary>
                          <BookOpen size={14} /> Sources &amp; captured data
                        </summary>
                        {t.evidence.map((e, i) =>
                          typeof e === "object" && e !== null && "source" in e ? (
                            <div key={i}>
                              <strong>{String(e.source)}</strong>
                              <small>
                                {"capturedAt" in e
                                  ? new Date(String(e.capturedAt)).toLocaleString()
                                  : "Current scoped snapshot"}
                              </small>
                              <p>
                                {e.source === "orders.listServiceHistory"
                                  ? "Order amounts are snapshots, not payments."
                                  : e.source === "menu.listMenus"
                                    ? "Draft counts are not guest publication."
                                    : "Visible outlet data only."}
                              </p>
                            </div>
                          ) : null
                        )}
                      </details>
                    )}
                    {caps &&
                      routesForEvidence(
                        t.evidence,
                        caps.navigation.map((n) => n.id)
                      ).map((link) => (
                        <button
                          className="mm-ember-navigate"
                          key={link.id}
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            router.push(navigation[link.id].href);
                          }}
                        >
                          {link.label}
                          <ArrowRight size={14} />
                        </button>
                      ))}
                  </div>
                </article>
              ))}
              {actionOpen && caps?.actionsEnabled && (
                <section
                  className="mm-ember-action-editor"
                  aria-label="Prepare availability proposal"
                >
                  <div className="mm-ember-section-head">
                    <div>
                      <span className="mm-ember-overline">REVIEW BEFORE CHANGE</span>
                      <h3>Dish availability</h3>
                    </div>
                    <button
                      type="button"
                      className="mm-ember-icon"
                      aria-label="Close action editor"
                      onClick={() => setActionOpen(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p>
                    Only one dish in a published, assigned menu. Ember cannot publish or perform
                    financial actions.
                  </p>
                  <label>
                    Published menu
                    <select
                      value={menuId}
                      onChange={(e) => {
                        setMenuId(e.target.value);
                        setDishId("");
                      }}
                    >
                      <option value="">Select menu</option>
                      {options.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Dish
                    <select
                      value={dishId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setDishId(id);
                        const dish = currentMenu?.items.find((i) => i.id === id);
                        if (dish) setDesiredSoldOut(!dish.soldOut);
                      }}
                    >
                      <option value="">Select dish</option>
                      {currentMenu?.items.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.category} · {i.name}
                          {i.soldOut ? " · Sold out" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentDish && (
                    <div className="mm-ember-state">
                      <span>
                        Current: <b>{currentDish.soldOut ? "Sold out" : "Available"}</b>
                      </span>
                      <span>
                        Proposed: <b>{desiredSoldOut ? "Sold out" : "Available"}</b>
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="mm-ember-primary"
                    disabled={busy || !currentDish || currentDish.soldOut === desiredSoldOut}
                    onClick={() => void propose()}
                  >
                    Create review proposal <ArrowRight size={16} />
                  </button>
                </section>
              )}
              {proposals.map((p) => (
                <section
                  key={p.id}
                  className="mm-ember-proposal"
                  aria-label="Availability action proposal"
                >
                  <span className="mm-ember-overline">
                    ACTION ·{" "}
                    {p.status === "pending" ? "AWAITING YOUR CONFIRMATION" : p.status.toUpperCase()}
                  </span>
                  <h3>{p.dishName}</h3>
                  <p>{p.menuName} · this outlet only</p>
                  <div className="mm-ember-state">
                    <span>
                      Before: <b>{p.beforeSoldOut ? "Sold out" : "Available"}</b>
                    </span>
                    <span>
                      After: <b>{p.desiredSoldOut ? "Sold out" : "Available"}</b>
                    </span>
                  </div>
                  <small>
                    Revision {p.expectedRevision} · Expires{" "}
                    {new Date(p.expiresAt).toLocaleTimeString()}
                  </small>
                  {p.status === "pending" && new Date(p.expiresAt).getTime() > now ? (
                    <>
                      <label className="mm-ember-ack">
                        <input
                          type="checkbox"
                          checked={acknowledged === p.id}
                          onChange={(e) => setAcknowledged(e.target.checked ? p.id : null)}
                        />{" "}
                        I have reviewed this exact change.
                      </label>
                      <div className="mm-ember-decision">
                        <button
                          type="button"
                          disabled={busy || acknowledged !== p.id}
                          onClick={() => void decide(p, "confirm")}
                          className="mm-ember-primary"
                        >
                          <Check size={15} /> Confirm change
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide(p, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  ) : p.status === "pending" ? (
                    <p>Expired. Create a fresh proposal.</p>
                  ) : (
                    <p role="status">
                      {p.status === "confirmed"
                        ? "Confirmed in the current menu revision."
                        : p.status === "stale"
                          ? "Menu changed. No action was applied."
                          : "Rejected. No change was made."}
                    </p>
                  )}
                </section>
              ))}
            </div>
            <div className="mm-ember-footer">
              {error && (
                <p className="mm-ember-error" role="alert">
                  {error}
                </p>
              )}
              {status && (
                <p className="mm-ember-note" role="status">
                  {status}
                </p>
              )}
              <form onSubmit={send}>
                <label htmlFor="mm-ember-prompt" className="sr-only">
                  Ask Ember
                </label>
                <textarea
                  id="mm-ember-prompt"
                  maxLength={4000}
                  rows={2}
                  value={prompt}
                  disabled={busy}
                  placeholder="Ask about this outlet…"
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button type="submit" disabled={busy || !prompt.trim()} aria-label="Send message">
                  {busy ? <LoaderCircle size={18} className="mm-ember-spin" /> : <Send size={18} />}
                </button>
              </form>
              <p>
                <ShieldCheck size={12} /> Read-only answers. Changes require your confirmation.
              </p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
