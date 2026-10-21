"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
  X,
} from "lucide-react";
import { filterQrCodes, qrDestination, qrStatistics } from "./qr-studio-types";
import type { QR, QRFilter, PrintFormat } from "./qr-studio-types";
import { QrPrintSheet } from "./qr-print-sheet";
import styles from "./qr-print.module.css";

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
  const [filter, setFilter] = useState<QRFilter>("active");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(pageSize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [label, setLabel] = useState("");
  const [pointLabel, setPointLabel] = useState("");
  const [showCreate, setShowCreate] = useState(true);
  const [format, setFormat] = useState<PrintFormat>("stand");
  const [printId, setPrintId] = useState<string | null>(null);
  const [danger, setDanger] = useState<Danger | null>(null);
  const [confirmed, setConfirmed] = useState("");
  const retry = useRef({ signature: "", key: "" });
  const running = useRef(false);
  const dangerDialog = useRef<HTMLDialogElement>(null);
  const pointRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => qrStatistics(codes), [codes]);
  const visible = useMemo(() => filterQrCodes(codes, query, filter), [codes, query, filter]);
  const selected = codes.find((q) => q.id === selectedId) ?? null;
  const selectedUrl = selected ? qrDestination(origin, selected.destinationToken) : "";
  useEffect(() => {
    const clear = () => setPrintId(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

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
        setSelectedId(next.id);
        setFilter("active");
      } else {
        setSelectedId(result.id ?? selectedId);
        setFilter("all");
      }
      if (action === "create") {
        setLabel("");
        setPointLabel("");
        setShowCreate(false);
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
  function print(q: QR) {
    if (!q.isActive) return;
    flushSync(() => setPrintId(q.id));
    window.print();
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
              onClick={() => {
                setShowCreate(true);
                document
                  .getElementById("qr-create")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            >
              {" "}
              <Plus size={17} aria-hidden="true" /> Create QR
            </button>
            <button
              type="button"
              className="qr-secondary"
              onClick={() =>
                document
                  .getElementById("qr-print-studio")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              <Printer size={17} aria-hidden="true" /> Print Studio
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

        <section className="qr-create-section" id="qr-create" aria-labelledby="qr-create-title">
          <div className="qr-create-head">
            <div>
              <span className="qr-eyebrow">MAKE A NEW CONNECTION</span>
              <h2 id="qr-create-title">Create a permanent QR</h2>
              <p>
                Label it for your staff. Add an optional service-point label for a table or counter.
              </p>
            </div>
            <button
              type="button"
              className="qr-outline"
              aria-expanded={showCreate}
              aria-controls="qr-create-fields"
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? "Close creator" : "Open creator"}
            </button>
          </div>
          {showCreate && (
            <form
              id="qr-create-fields"
              className="qr-create-form"
              onSubmit={(e) => {
                e.preventDefault();
                const cleanLabel = label.trim(),
                  cleanPoint = pointLabel.trim();
                if (!cleanLabel) return;
                void command("create", {
                  label: cleanLabel,
                  ...(cleanPoint ? { pointLabel: cleanPoint } : {}),
                });
              }}
            >
              <div className="qr-create-grid">
                <label className="field">
                  QR label{" "}
                  <input
                    name="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    maxLength={80}
                    placeholder="Front counter menu"
                  />
                </label>
                <label className="field">
                  Table / counter label (optional){" "}
                  <input
                    ref={pointRef}
                    name="pointLabel"
                    value={pointLabel}
                    onChange={(e) => setPointLabel(e.target.value)}
                    maxLength={80}
                    placeholder="Table 4"
                  />
                </label>
              </div>
              <div className="qr-create-bottom">
                <p>
                  A service-point label provides guest context. It does not enable ordering or prove
                  physical presence.
                </p>
                <button className="ember" disabled={busy || !label.trim()} type="submit">
                  <Plus size={17} aria-hidden="true" /> Create QR code
                </button>
              </div>
            </form>
          )}
        </section>

        {codes.length === 0 ? (
          <section className="qr-empty" aria-labelledby="qr-empty-heading">
            <Image src={art + "first-qr-empty-illustration.webp"} width={350} height={300} alt="" />
            <div>
              <span className="qr-eyebrow">YOUR FIRST PRINTED CONNECTION</span>
              <h2 id="qr-empty-heading">Your table is ready. Let guests find you.</h2>
              <p>
                Create a permanent code above, print it, and keep updating your menu without
                changing the printed link.
              </p>
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
                  onChange={(e) => { setQuery(e.target.value); setShown(pageSize); }}
                  placeholder="Find a code by label"
                />
              </label>
              <div className="qr-filter" role="group" aria-label="Filter QR status">
                {(["active", "revoked", "all"] as const).map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => { setFilter(value); setShown(pageSize); }}
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
                      onClick={() => setSelectedId(q.id)}
                    >
                      <span className="qr-list-icon">
                        <QrCode size={20} aria-hidden="true" />
                      </span>
                      <span className="qr-list-name">
                        <strong>{q.label ?? "Menu QR"}</strong>
                        <small>
                          {q.tableId ? "Service-point QR" : "Menu QR"} ·{" "}
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
            <div className={styles.cards} data-print-selected={printId !== null}>
              {selected ? (
                <section
                  className="qr-selected"
                  data-print-target={printId === selected.id}
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
                            ? "Service-point context is linked to this code."
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
                            "/api/qr/" + encodeURIComponent(selected.id) + "/download?format=svg"
                          }
                          className="qr-download"
                        >
                          <FileImage size={16} aria-hidden="true" /> Download SVG
                        </a>
                        <button type="button" onClick={() => print(selected)}>
                          <Printer size={16} aria-hidden="true" /> Print
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
                      <div className="qr-print-studio" id="qr-print-studio">
                        <div className="qr-print-intro">
                          <div>
                            <span className="qr-eyebrow">THE PRINT STUDIO</span>
                            <h3>From screen to tabletop.</h3>
                            <p>
                              Choose a physical format. The design uses this QR&apos;s real
                              downloadable matrix.
                            </p>
                          </div>
                          <Image
                            src={art + "print-studio-illustration.webp"}
                            width={126}
                            height={95}
                            alt=""
                          />
                        </div>
                        <div className="qr-format-picker" role="group" aria-label="Print template">
                          {(
                            [
                              { id: "stand", name: "Table Stand" },
                              { id: "sticker", name: "Window / Counter Sticker" },
                              { id: "insert", name: "Menu Insert" },
                            ] as const
                          ).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              aria-pressed={format === t.id}
                              onClick={() => setFormat(t.id)}
                            >
                              {t.name}
                            </button>
                          ))}
                        </div>
                        <QrPrintSheet
                          qr={selected}
                          format={format}
                          restaurant={outletName}
                          origin={origin}
                          active={printId === selected.id}
                        />
                        <button
                          type="button"
                          className="ember qr-print-action"
                          onClick={() => print(selected)}
                        >
                          <Printer size={16} aria-hidden="true" /> Print this design
                        </button>
                      </div>
                      {canRevoke && (
                        <details className="qr-danger">
                          <summary>
                            <ShieldAlert size={17} aria-hidden="true" /> Manage QR identity
                          </summary>
                          <p>
                            These are destructive operations. Existing printed codes cannot be
                            redirected after revocation. Regeneration creates a new QR and retires
                            the old one; if this code is the canonical outlet destination, that
                            public destination may also rotate.
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
        {message === "QR code created" && (
          <section className="qr-celebration">
            <Image src={art + "qr-creation-celebration.webp"} width={150} height={113} alt="" />
            <div>
              <span className="qr-eyebrow">A NEW CONNECTION</span>
              <h2>Your QR is ready to serve.</h2>
              <p>
                The server confirmed creation. Download, print or share it from the selected
                workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss creation message"
            >
              <X size={18} />
            </button>
          </section>
        )}
      </div>
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
