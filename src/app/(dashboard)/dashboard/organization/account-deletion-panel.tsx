"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";

type DeletionStatus = {
  ticketNumber: number;
  createdAt: string;
  dueAt: string;
  cancelledAt: string | null;
  canCancel: boolean;
};

function dueDate(value: string) {
  const millis = new Date(value).getTime();
  if (Number.isNaN(millis)) return "the stated deadline";
  // API uses exclusive midnight UTC: display the seventh weekday, not the next day.
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(millis - 1));
}

export function AccountDeletionPanel({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId?: string;
}) {
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const reload = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/account/deletion-request", {
      cache: "no-store",
      signal,
    });
    if (!response.ok) throw new Error("Unable to check your account deletion request.");
    const result = (await response.json()) as DeletionStatus | null;
    if (!signal?.aborted) setStatus(result);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal)
      .catch(() => {
        if (!controller.signal.aborted) setError("Unable to check deletion requests. Please retry.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  async function submit(method: "POST" | "DELETE") {
    if (busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const payload =
        method === "POST"
          ? { organizationId, outletId, confirm: true }
          : { confirm: true };
      const response = await fetch("/api/account/deletion-request", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to update your request.");
      setConfirm(false);
      setConfirming(false);
      await reload();
      setFeedback(
        method === "POST"
          ? "Your deletion request has been sent to the admin team."
          : "Your account deletion request has been withdrawn."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your request.");
    } finally {
      setBusy(false);
    }
  }

  const active = status && !status.cancelledAt;
  return (
    <section className="oh-account-deletion" aria-label="Personal account deletion">
      <div className="oh-account-deletion-heading">
        <div>
          <h3 className="oh-subtitle">Delete account</h3>
          <p className="oh-hint">
            Request deletion of your personal MenuMinute account, not just this organization.
            An administrator reviews ownership, retained business records and the request.
          </p>
        </div>
        <Trash2 size={19} aria-hidden="true" />
      </div>
      {loading ? (
        <p role="status" className="oh-hint">Checking deletion requests…</p>
      ) : active ? (
        <div className="oh-deletion-request">
          <strong>Deletion request #{status.ticketNumber} is active</strong>
          <p>
            Your account is scheduled for deletion review within 7 working days.
            You can withdraw your request through <strong>{dueDate(status.dueAt)}</strong> (UTC).
            Some records may require legal retention.
          </p>
          {status.canCancel ? (
            confirming ? (
              <div className="oh-deletion-confirm">
                <p>Withdraw your deletion request? Your account will remain active.</p>
                <div className="oh-deletion-actions">
                  <button
                    type="button"
                    className="oh-secondary"
                    disabled={busy}
                    onClick={() => void submit("DELETE")}
                  >
                    {busy ? "Withdrawing…" : "Yes, withdraw request"}
                  </button>
                  <button type="button" className="oh-deletion-text" onClick={() => setConfirming(false)} disabled={busy}>
                    Keep request
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="oh-deletion-text" onClick={() => setConfirming(true)}>
                Withdraw deletion request
              </button>
            )
          ) : (
            <p className="oh-hint">
              The self-service withdrawal window has ended. Contact support immediately if you
              need help with this request.
            </p>
          )}
        </div>
      ) : (
        <>
          {status?.cancelledAt && (
            <p className="oh-hint" role="status">
              Your previous deletion request #{status.ticketNumber} was withdrawn.
            </p>
          )}
          {confirming ? (
            <div className="oh-deletion-confirm">
              <strong>Request account deletion?</strong>
              <p>
                The admin team will review the request for deletion within 7 working days
                (Monday–Friday). You can withdraw it until the end of the seventh working day.
                Public holidays or legal retention requirements may affect processing.
              </p>
              <label className="oh-deletion-check">
                <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
                I understand this concerns my entire account and may affect my restaurants and team.
              </label>
              <div className="oh-deletion-actions">
                <button
                  type="button"
                  className="oh-deletion-danger"
                  disabled={!confirm || busy || !outletId}
                  onClick={() => void submit("POST")}
                >
                  {busy ? "Submitting…" : "Submit deletion request"}
                </button>
                <button type="button" className="oh-deletion-text" disabled={busy} onClick={() => { setConfirming(false); setConfirm(false); }}>
                  Keep my account
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="oh-deletion-danger"
              disabled={!outletId}
              onClick={() => { setConfirming(true); setConfirm(false); }}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete Account
            </button>
          )}
          {!outletId && (
            <p className="oh-hint">
              No outlet is available for this organization. You can still request deletion from
              our <Link href="/delete-account">privacy request page</Link>.
            </p>
          )}
        </>
      )}
      {error && <p className="oh-deletion-error" role="alert">{error}</p>}
      {!loading && error && !confirming && (
        <button type="button" className="oh-deletion-text" onClick={() => { setError(""); setLoading(true); void reload().catch(() => setError("Unable to load request status.")).finally(() => setLoading(false)); }}>
          Retry
        </button>
      )}
      <p className="oh-deletion-feedback" aria-live="polite" role="status">{feedback}</p>
    </section>
  );
}
