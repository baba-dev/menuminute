"use client";
import { useState, useRef } from "react";
import { QrCode, Download, Printer } from "lucide-react";
type QR = {
  id: string;
  label: string | null;
  destinationToken: string;
  isActive: boolean;
  tableId: string | null;
};
export function QrManager({
  initial,
  outletId,
  canRevoke,
}: {
  initial: QR[];
  outletId: string;
  canRevoke: boolean;
}) {
  const [codes, setCodes] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const retry = useRef({ signature: "", key: "" });
  async function command(action: string, data: Record<string, unknown>) {
    const signature = JSON.stringify({ action, data });
    if (signature !== retry.current.signature)
      retry.current = { signature, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/qr", {
        method: "POST",
        headers: { "content-type": "application/json", "x-outlet-id": outletId },
        body: JSON.stringify({ key: retry.current.key, action, data }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.message);
      const q = await fetch("/api/qr", { headers: { "x-outlet-id": outletId } });
      if (!q.ok) throw new Error("Unable to refresh QR list");
      setCodes(await q.json());
      setMessage(
        action === "create"
          ? "QR code created"
          : action === "regenerate"
            ? "New QR created. The old printed code is revoked."
            : "QR code revoked"
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "QR operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product stack">
      <header className="row between">
        <div>
          <span className="eyebrow">Print once. Keep serving.</span>
          <h1>Permanent QR codes</h1>
          <p>
            Menu edits, outlet renames and subscription changes keep these links. Only explicit
            revocation or regeneration replaces a code.
          </p>
        </div>
        <QrCode size={52} />
      </header>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <p role="status">{message}</p>
      <form
        className="panel stack no-print"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void command("create", {
            label: f.get("label"),
            ...(f.get("pointLabel") ? { pointLabel: f.get("pointLabel") } : {}),
          });
        }}
      >
        <h2>Create a menu or service-point QR</h2>
        <div className="columns">
          <label className="field">
            QR label
            <input name="label" required maxLength={80} placeholder="Front counter menu" />
          </label>
          <label className="field">
            Table / counter label (optional)
            <input name="pointLabel" maxLength={80} placeholder="Table 4" />
          </label>
        </div>
        <p>
          A service-point label gives guests context. It does not enable ordering or prove physical
          presence.
        </p>
        <button className="ember" disabled={busy}>
          Create QR code
        </button>
      </form>
      <div className="columns">
        {codes.map((q) => (
          <section className="panel stack" key={q.id}>
            <div className="row between">
              <h2>{q.label ?? "Menu QR"}</h2>
              <span className="badge">{q.isActive ? "Active" : "Revoked"}</span>
            </div>
            {q.isActive && (
              <>
                <div className="qr-picture">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/qr/${q.id}/download?format=svg&inline=1`}
                    width={240}
                    height={240}
                    alt={`${q.label ?? "Menu"} QR code`}
                  />
                </div>
                <a href={`/m/${q.destinationToken}`} target="_blank" className="action">
                  Open public menu
                </a>
                <div className="row">
                  <a href={`/api/qr/${q.id}/download`} className="action">
                    <Download size={16} />
                    Download PNG
                  </a>
                  <a href={`/api/qr/${q.id}/download?format=svg`} className="action">
                    Download SVG
                  </a>
                  <button type="button" onClick={() => window.print()}>
                    <Printer size={16} />
                    Print
                  </button>
                </div>
                <small className="print-only">
                  {typeof window === "undefined" ? "" : window.location.origin}/m/
                  {q.destinationToken}
                </small>
                {canRevoke && (
                  <div className="row no-print">
                    <button
                      type="button"
                      className="danger"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm("Revoke this printed QR? It will stop opening the menu.")
                        )
                          void command("revoke", { qrId: q.id });
                      }}
                    >
                      Revoke QR
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "Regenerate this QR? The old printed code will stop working."
                          )
                        )
                          void command("regenerate", { qrId: q.id });
                      }}
                    >
                      Regenerate QR
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        ))}
      </div>
      {!codes.length && (
        <p className="panel quiet">No QR codes yet. Create your first code above.</p>
      )}
    </div>
  );
}
