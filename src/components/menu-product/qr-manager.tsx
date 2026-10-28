"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  ClipboardCopy,
  Download,
  ExternalLink,
  FileImage,
  History,
  MapPin,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { filterQrCodes, qrDestination, qrStatistics } from "./qr-studio-types";
import type { QR, QRFilter } from "./qr-studio-types";
import { QrPrintStudio } from "./qr-print-studio";
import { QrCreateDialog } from "./qr-create-dialog";

const art = "/brand/qr-studio/tabletop-press/";
const pageSize = 24;
type Danger = { action: "revoke" | "regenerate"; qr: QR };
type Result = { id?: string; token?: string; revoked?: boolean };

export function QrManager({
  initial,
  outletId,
  outletName,
  canRevoke,
  origin,
}: {
  initial: QR[];
  outletId: string;
  outletName: string;
  canRevoke: boolean;
  origin: string;
}) {
  const [codes, setCodes] = useState(initial);
  const [selectedId, setSelectedId] = useState(
    initial.find((q) => q.isActive)?.id ?? initial[0]?.id ?? null
  );
  const [filter, setFilter] = useState<QRFilter>(
    initial.some((q) => q.isActive) ? "active" : "all"
  );
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(pageSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<QR | null>(null);
  const [tab, setTab] = useState<"library" | "print">("library");
  const [danger, setDanger] = useState<Danger | null>(null);
  const [confirmed, setConfirmed] = useState("");
  const retry = useRef({ signature: "", key: "" });
  const running = useRef(false);
  const dangerDialog = useRef<HTMLDialogElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  const stats = useMemo(() => qrStatistics(codes), [codes]);
  const visible = useMemo(() => filterQrCodes(codes, query, filter), [codes, query, filter]);
  const selected = codes.find((q) => q.id === selectedId) ?? null;
  const selectedUrl = selected ? qrDestination(origin, selected.destinationToken) : "";

  async function refresh() {
    const response = await fetch("/api/qr", {
      headers: { "x-outlet-id": outletId },
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(
        "The request may have completed but the library could not refresh. Recheck before trying again."
      );
    const body: unknown = await response.json();
    if (!Array.isArray(body)) throw new Error("The updated QR inventory could not be verified.");
    setCodes(body as QR[]);
    return body as QR[];
  }
  async function command(
    action: "create" | "revoke" | "regenerate",
    data: Record<string, unknown>
  ) {
    if (running.current) return;
    running.current = true;
    const signature = JSON.stringify({ action, data, outletId });
    if (retry.current.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json", "x-outlet-id": outletId },
        body: JSON.stringify({ key: retry.current.key, action, data }),
      });
      const body: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof body === "object" && body && "message" in body && typeof body.message === "string"
            ? body.message
            : "QR operation failed. Check the inventory before retrying."
        );
      const result = body as Result;
      const latest = await refresh();
      if (action === "create" || action === "regenerate") {
        const next = latest.find((q) => q.id === result.id);
        if (!next)
          throw new Error(
            "The command was accepted, but the new QR is not yet visible. Refresh before retrying."
          );
        selectCode(next.id);
        setFilter("active");
        if (action === "create") setCreated(next);
      } else {
        setSelectedId(result.id ?? selectedId);
        setFilter("all");
      }
      retry.current = { signature: "", key: "" };
      setMessage(
        action === "create"
          ? "QR code created"
          : action === "revoke"
            ? "QR code revoked"
            : "New QR created. The old printed code is revoked."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The QR operation could not be confirmed. Refresh before retrying."
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function sync() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await refresh();
      setMessage("QR library refreshed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to refresh QR library");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(selectedUrl);
      setMessage("Permanent destination copied");
      setError("");
    } catch {
      setError("Clipboard access was blocked. Select and copy the visible fallback URL instead.");
    }
  }
  function scrollToSection(id: string, block: ScrollLogicalPosition = "start") {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block });
  }
  function selectCode(id: string) {
    setSelectedId(id);
    if (tab === "library" && window.matchMedia("(max-width: 1050px)").matches) {
      window.requestAnimationFrame(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        detailRef.current?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
        detailRef.current?.focus({ preventScroll: true });
      });
    }
  }
  function openCreate() {
    if (busy) return;
    setCreated(null);
    setError("");
    setCreateOpen(true);
  }
  function openPrintStudio() {
    const active = selected?.isActive ? selected : codes.find((q) => q.isActive);
    if (!active) {
      openCreate();
      return;
    }
    setSelectedId(active.id);
    setTab("print");
    window.requestAnimationFrame(() => scrollToSection("qr-tab-navigation"));
  }
  function ask(action: Danger["action"], q: QR) {
    setDanger({ action, qr: q });
    setConfirmed("");
    dangerDialog.current?.showModal();
  }
  function confirmDanger() {
    if (!danger || confirmed !== danger.action.toUpperCase()) return;
    const { action, qr } = danger;
    dangerDialog.current?.close();
    setDanger(null);
    void command(action, { qrId: qr.id });
  }

  return (
    <div className="product qr-studio" data-testid="tabletop-press">
      <header className="qr-hero">
        <div className="qr-hero-copy">
          <span className="qr-eyebrow">MENUMINUTE / THE TABLETOP PRESS</span>
          <h1>
            Print once.
            <br />
            Keep serving.
          </h1>
          <p>
            Beautiful permanent connections to {outletName}&apos;s menu. Update dishes without
            reprinting your existing codes.
          </p>
          <div className="qr-hero-actions">
            <button
              type="button"
              onClick={openCreate}
            >
              {" "}
              <Plus size={17} aria-hidden="true" /> Create QR
            </button>
            <button type="button" className="qr-secondary" onClick={openPrintStudio}>
              <Printer size={17} aria-hidden="true" /> Open Print Studio
            </button>
          </div>
        </div>
        <span className="qr-hero-caption" aria-hidden="true">
          GOOD FOOD DESERVES A BEAUTIFUL INTRODUCTION
        </span>
      </header>

      <div className="qr-body">
        <div className="qr-notifications" aria-live="polite">
          {error && (
            <p className="error" role="alert">
              {error}{" "}
              <button type="button" onClick={() => void sync()} disabled={busy}>
                Refresh library
              </button>
            </p>
          )}
          <p role="status">{message}</p>
        </div>
        <nav id="qr-tab-navigation" className="qr-tab-nav" aria-label="QR workspace">
          <button
            type="button"
            aria-current={tab === "library" ? "page" : undefined}
            onClick={() => setTab("library")}
          >
            <QrCode size={18} aria-hidden="true" /> QR Library{" "}
            <span>Manage permanent destinations</span>
          </button>
          <button
            type="button"
            aria-current={tab === "print" ? "page" : undefined}
            onClick={openPrintStudio}
            aria-label="Print Studio"
          >
            <Printer size={18} aria-hidden="true" /> Print Studio{" "}
            <span>Design beautiful printed invitations</span>
          </button>
        </nav>
        {tab === "library" && (
          <>
            <section className="qr-overview" aria-label="QR inventory at a glance">
              <div className="qr-heading">
                <h2 className="qr-eyebrow">YOUR QR COLLECTION</h2>
                <span>Current outlet · Verified inventory</span>
              </div>
              <div className="qr-metrics">
                {[
                  {
                    label: "Active codes",
                    value: stats.active,
                    icon: QrCode,
                    help: "Currently usable permanent destination tokens.",
                  },
                  {
                    label: "Service points",
                    value: stats.servicePoints,
                    icon: MapPin,
                    help: "Active codes associated with a service point; this does not activate ordering.",
                  },
                  {
                    label: "Revoked codes",
                    value: stats.revoked,
                    icon: History,
                    help: "Retired destination tokens that cannot be downloaded or scanned.",
                  },
                  {
                    label: "Total codes",
                    value: stats.total,
                    icon: BookOpen,
                    help: "All codes for this outlet, including revoked entries. Not a scan count.",
                  },
                ].map(({ label, value, icon: Icon, help }) => (
                  <div className="qr-metric" key={label}>
                    <div className="qr-metric-top">
                      <span className="qr-metric-icon">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <strong>{label}</strong>
                      <details>
                        <summary aria-label={"About " + label}>
                          <CircleHelp size={15} aria-hidden="true" />
                        </summary>
                        <p>{help}</p>
                      </details>
                    </div>
                    <span className="qr-metric-value">{value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>

            {codes.length === 0 ? (
              <section className="qr-empty" aria-labelledby="qr-empty-heading">
                <Image
                  src={art + "first-qr-empty-illustration.webp"}
                  width={350}
                  height={300}
                  alt=""
                />
                <div>
                  <span className="qr-eyebrow">YOUR FIRST PRINTED CONNECTION</span>
                  <h2 id="qr-empty-heading">Your table is ready. Let guests find you.</h2>
                  <p>
                    Create your first permanent QR using the button below. Menu edits will not
                    change its printed destination.
                  </p>
                  <button type="button" className="qr-outline" onClick={openCreate}>
                    <Plus size={17} aria-hidden="true" /> Create your first QR
                  </button>
                </div>
              </section>
            ) : (
              <div className="qr-workspace">
                <section className="qr-library" aria-labelledby="qr-library-heading">
                  <div className="qr-heading">
                    <h2 id="qr-library-heading">Your QR library</h2>
                    <button
                      type="button"
                      onClick={() => void sync()}
                      disabled={busy}
                      aria-label="Refresh QR library"
                    >
                      <RefreshCw size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <label className="qr-search">
                    <Search size={17} aria-hidden="true" />
                    <span className="sr-only">Search QR labels</span>
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setShown(pageSize);
                      }}
                      placeholder="Find a code by label"
                    />
                  </label>
                  <div className="qr-filter" role="group" aria-label="Filter QR status">
                    {(["active", "revoked", "all"] as const).map((value) => (
                      <button
                        type="button"
                        key={value}
                        aria-pressed={filter === value}
                        onClick={() => {
                          setFilter(value);
                          setShown(pageSize);
                        }}
                      >
                        {value === "all" ? "All codes" : value === "active" ? "Active" : "Revoked"}
                      </button>
                    ))}
                  </div>
                  <ul className="qr-list">
                    {visible.slice(0, shown).map((q) => (
                      <li key={q.id}>
                        <button
                          type="button"
                          aria-current={selectedId === q.id ? "true" : undefined}
                          onClick={() => selectCode(q.id)}
                        >
                          <span className="qr-list-icon">
                            <QrCode size={20} aria-hidden="true" />
                          </span>
                          <span className="qr-list-name">
                            <strong>{q.label ?? "Menu QR"}</strong>
                            <small>
                              {q.tableId ? (q.pointLabel ?? "Service-point QR") : "Menu QR"} ·{" "}
                              {q.isActive ? "Active" : "Revoked"}
                            </small>
                          </span>
                          <ChevronRight size={17} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {!visible.length && (
                    <p className="qr-no-results">
                      No matching codes. Try another label or status filter.
                    </p>
                  )}
                  {visible.length > shown && (
                    <button
                      type="button"
                      className="qr-outline qr-load"
                      onClick={() => setShown((n) => n + pageSize)}
                    >
                      Show more ({visible.length - shown} remaining)
                    </button>
                  )}
                </section>
                <div className="qr-details">
                  {selected ? (
                    <section
                      className="qr-selected"
                      ref={detailRef}
                      tabIndex={-1}
                      data-qr-active={selected.isActive}
                      aria-labelledby="qr-selected-title"
                    >
                      <div className="qr-selected-heading">
                        <div>
                          <span className="qr-eyebrow">SELECTED QR</span>
                          <h2 id="qr-selected-title">{selected.label ?? "Menu QR"}</h2>
                        </div>
                        <span className={"qr-pill" + (selected.isActive ? " is-active" : "")}>
                          {selected.isActive ? "Active" : "Revoked"}
                        </span>
                      </div>
                      {selected.isActive ? (
                        <>
                          <div className="qr-selected-inner">
                            <div className="qr-matrix-frame">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={
                                  "/api/qr/" +
                                  encodeURIComponent(selected.id) +
                                  "/download?format=svg&inline=1"
                                }
                                width={260}
                                height={260}
                                alt={"Scannable QR for " + (selected.label ?? outletName)}
                              />
                              <small>Real scannable destination · Keep the quiet zone intact</small>
                            </div>
                            <p className="qr-selected-note">
                              {selected.tableId
                                ? selected.pointLabel
                                  ? "This QR serves " + selected.pointLabel + "."
                                  : "Service-point context is linked to this code."
                                : "Permanent menu destination."}{" "}
                              The printed QR stays valid after menu edits.
                            </p>
                          </div>
                          <div className="qr-detail-actions">
                            <a
                              href={"/api/qr/" + encodeURIComponent(selected.id) + "/download"}
                              className="qr-download"
                            >
                              <Download size={16} aria-hidden="true" /> Download PNG
                            </a>
                            <a
                              href={
                                "/api/qr/" +
                                encodeURIComponent(selected.id) +
                                "/download?format=svg"
                              }
                              className="qr-download"
                            >
                              <FileImage size={16} aria-hidden="true" /> Download SVG
                            </a>
                            <button
                              type="button"
                              className="qr-design-action"
                              onClick={openPrintStudio}
                            >
                              <Printer size={16} aria-hidden="true" /> Design & Print
                            </button>
                            <button type="button" onClick={() => void copyLink()}>
                              <ClipboardCopy size={16} aria-hidden="true" /> Copy link
                            </button>
                            <a
                              href={"/m/" + encodeURIComponent(selected.destinationToken)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={16} aria-hidden="true" /> Open destination
                            </a>
                          </div>
                          <div className="qr-fallback">
                            <span>Permanent fallback URL</span>
                            <code>{selectedUrl}</code>
                          </div>
                          {canRevoke && (
                            <details className="qr-danger">
                              <summary>
                                <ShieldAlert size={17} aria-hidden="true" /> Manage QR identity
                              </summary>
                              <p>
                                These are destructive operations. Existing printed codes cannot be
                                redirected after revocation. Regeneration creates a new QR and
                                retires the old one; if this code is the canonical outlet
                                destination, that public destination may also rotate.
                              </p>
                              <div>
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={busy}
                                  onClick={() => ask("revoke", selected)}
                                >
                                  Revoke QR
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => ask("regenerate", selected)}
                                >
                                  Regenerate QR
                                </button>
                              </div>
                            </details>
                          )}
                        </>
                      ) : (
                        <div className="qr-revoked-message">
                          <History size={28} aria-hidden="true" />
                          <p>
                            This code has been revoked. It cannot be scanned, downloaded or printed.
                            Select another active QR or create a replacement.
                          </p>
                        </div>
                      )}
                    </section>
                  ) : (
                    <section className="qr-selected">
                      <p>Select a QR to preview its destination and print formats.</p>
                    </section>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        {tab === "print" && (
          <QrPrintStudio
            codes={codes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onBack={() => setTab("library")}
            restaurant={outletName}
            origin={origin}
            outletId={outletId}
          />
        )}
      </div>
      <QrCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        outletName={outletName}
        origin={origin}
        busy={busy}
        error={error}
        created={created}
        existingLabels={codes.map((code) => code.label ?? "")}
        onCreate={(name, point) => void command("create", {
          label: name,
          ...(point ? { pointLabel: point } : {}),
        })}
        onReset={() => { setCreated(null); setError(""); }}
        onLibrary={() => { setCreateOpen(false); setTab("library"); }}
        onPrint={() => {
          setCreateOpen(false);
          setTab("print");
          window.requestAnimationFrame(() => scrollToSection("qr-tab-navigation"));
        }}
      />
      <dialog
        className="qr-confirm"
        ref={dangerDialog}
        aria-labelledby="qr-danger-title"
        onClose={() => {
          setDanger(null);
          setConfirmed("");
        }}
      >
        <form method="dialog" onSubmit={(e) => e.preventDefault()}>
          <span className="qr-eyebrow">PERMANENT LINK MANAGEMENT</span>
          <h2 id="qr-danger-title">
            {danger?.action === "revoke" ? "Revoke this printed QR?" : "Generate a replacement QR?"}
          </h2>
          <p>
            {danger?.action === "revoke"
              ? "The old code will stop opening your menu. Existing printed copies cannot be reused."
              : "The old printed code will stop working. A replacement token will be issued. A canonical outlet destination may rotate too."}
          </p>
          <label className="field">
            Type {danger?.action?.toUpperCase()} to continue
            <input
              autoComplete="off"
              value={confirmed}
              onChange={(e) => setConfirmed(e.target.value)}
            />
          </label>
          <div>
            <button type="button" onClick={() => dangerDialog.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              disabled={!danger || confirmed !== danger.action.toUpperCase() || busy}
              onClick={confirmDanger}
            >
              Confirm {danger?.action}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
