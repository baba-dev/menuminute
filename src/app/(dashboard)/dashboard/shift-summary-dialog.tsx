"use client";

import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  shiftSummaryPrompt,
  summaryFileName,
  unsupportedFigures,
  type SummaryEvidence,
} from "@/modules/dashboard/shift-summary";
import { outletLocalDate } from "@/modules/dashboard/milestones";

type Phase = "idle" | "working" | "ready" | "failed";
type Run = { status: "completed" | "failed"; answer?: string; evidence?: SummaryEvidence[] };

const jsonHeaders = { "content-type": "application/json" } as const;

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const data: unknown = await response.json().catch(() => null);
  // The turns API answers a durably recorded failed turn with HTTP 503 and a JSON body.
  if (!response.ok && !(data && typeof data === "object" && "status" in data)) {
    const message =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "Ember is unavailable right now.";
    throw new Error(message);
  }
  return data as T;
}

/**
 * Ember-drafted end-of-day summary. It is a read-only draft: nothing is saved, emailed or
 * published. Copy and download are explicit manager actions after review.
 */
export function ShiftSummaryDialog({
  organizationId,
  outletId,
  outletName,
  timezone,
}: {
  organizationId: string;
  outletId: string;
  outletName: string;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [evidence, setEvidence] = useState<SummaryEvidence[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [flagged, setFlagged] = useState<string[]>([]);
  // Reusing the same keys on a retry replays the stored turn instead of creating a second one.
  const keys = useRef({ conversation: crypto.randomUUID(), turn: crypto.randomUUID() });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const scope = { organizationId, outletId };

  async function generate(fresh: boolean) {
    if (phase === "working") return;
    if (fresh) keys.current = { conversation: crypto.randomUUID(), turn: crypto.randomUUID() };
    setPhase("working");
    setError("");
    setCopied(false);
    try {
      const conversation = await post<{ id: string }>("/api/assistant/conversations", {
        ...scope,
        key: keys.current.conversation,
      });
      const localDate = outletLocalDate(new Date(), timezone);
      const run = await post<Run>(
        "/api/assistant/conversations/" + encodeURIComponent(conversation.id) + "/turns",
        { ...scope, prompt: shiftSummaryPrompt(localDate), key: keys.current.turn }
      );
      if (run.status !== "completed" || !run.answer?.trim()) {
        setError("Ember could not verify a summary. No business change occurred.");
        setPhase("failed");
        return;
      }
      setDraft(run.answer);
      setEvidence(run.evidence ?? []);
      setFlagged(unsupportedFigures(run.answer, run.evidence ?? []));
      setPhase("ready");
    } catch (cause) {
      setError(
        (cause instanceof Error ? cause.message : "The summary could not be drafted.") +
          " Retrying reuses the same request, so nothing is duplicated."
      );
      setPhase("failed");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      textarea.current?.select();
      document.execCommand?.("copy");
    }
    setCopied(true);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([draft], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = summaryFileName(outletName, outletLocalDate(new Date(), timezone));
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className="mm-dashboard-button mm-dashboard-button--secondary">
          <FileText size={17} aria-hidden="true" /> Shift summary
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="mm-shift-overlay" />
        <Dialog.Content className="mm-shift-card" aria-describedby="mm-shift-description">
          <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div>
              <span className="mm-dashboard-eyebrow">{outletName} · Drafted by Ember</span>
              <Dialog.Title>Shift summary — draft</Dialog.Title>
              <Dialog.Description id="mm-shift-description">
                Ember reads today’s order, kitchen and dining-floor activity and writes a draft for
                you to review. Nothing is saved or sent.
              </Dialog.Description>
            </div>
            <Dialog.Close className="mm-icon-button" aria-label="Close shift summary">
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </header>

          {phase === "idle" && (
            <div className="mm-shift-actions">
              <button
                type="button"
                className="mm-dashboard-button mm-dashboard-button--primary"
                onClick={() => void generate(false)}
              >
                Draft today’s summary
              </button>
            </div>
          )}

          {phase === "working" && (
            <p role="status">
              <LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Gathering
              today’s figures and drafting the summary…
            </p>
          )}

          {phase === "failed" && (
            <>
              <div className="mm-shift-banner" role="alert">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
              <div className="mm-shift-actions">
                <button
                  type="button"
                  className="mm-dashboard-button mm-dashboard-button--primary"
                  onClick={() => void generate(false)}
                >
                  Try again
                </button>
              </div>
            </>
          )}

          {phase === "ready" && (
            <>
              <div className="mm-shift-banner">
                <TriangleAlert size={18} aria-hidden="true" />
                <span>
                  Draft. Check the figures before sharing. Order totals are not settled revenue, and
                  this summary makes no dietary or allergen claims.
                </span>
              </div>
              {flagged.length > 0 && (
                <div className="mm-shift-banner" role="alert">
                  <TriangleAlert size={18} aria-hidden="true" />
                  <span>
                    These figures were not found in the data Ember read: {flagged.join(", ")}.
                    Verify or remove them.
                  </span>
                </div>
              )}
              <label>
                <span className="sr-only">Shift summary draft, editable</span>
                <textarea
                  ref={textarea}
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setCopied(false);
                  }}
                />
              </label>
              <div className="mm-shift-actions">
                <button type="button" className="mm-icon-button" onClick={() => void copy()}>
                  {copied ? (
                    <ClipboardCheck size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" className="mm-icon-button" onClick={download}>
                  <Download size={16} aria-hidden="true" /> Download .txt
                </button>
                <button
                  type="button"
                  className="mm-icon-button"
                  onClick={() => void generate(true)}
                >
                  Redraft
                </button>
              </div>
              <p role="status" className="sr-only">
                {copied ? "Summary copied to the clipboard." : ""}
              </p>
              {evidence.length > 0 && (
                <details>
                  <summary>Data Ember read ({evidence.length})</summary>
                  <ul className="mm-shift-evidence">
                    {evidence.map((item, index) => (
                      <li key={index}>
                        {item.source ?? item.tool ?? "Data source"}
                        {item.capturedAt
                          ? " · " + new Date(item.capturedAt).toLocaleTimeString()
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
