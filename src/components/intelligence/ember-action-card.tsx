"use client";

import { useEffect, useRef, useState } from "react";

export type ActionRequest = {
  id: string;
  status: "pending" | "confirming" | "confirmed" | "rejected" | "stale" | "failed";
  kind: string;
  summary: string;
  expiresAt: string;
  createdAt: string;
  /** A short excerpt of the free text being sent (support requests), shown muted under the title. */
  preview?: string | null;
  result: { message?: string } | null;
};
type Decision = "confirm" | "reject";

/**
 * One quiet line per proposed change: what will happen, then Confirm / Not now. After a decision
 * it settles into a single receipt line. Motion is limited to a short entrance, a hairline
 * countdown and a drawn check; all of it is disabled by the layer's reduced-motion rule.
 */
export function EmberActionCard({
  request,
  now,
  onDecide,
}: {
  request: ActionRequest;
  now: number;
  onDecide: (request: ActionRequest, decision: Decision) => Promise<void>;
}) {
  const [working, setWorking] = useState<Decision | null>(null);
  const [problem, setProblem] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const expires = new Date(request.expiresAt).getTime();
  // Fixed once at mount (a negative delay skips the time already gone) so the hairline never jerks.
  const [timer] = useState(() => {
    const total = Math.max(1, expires - new Date(request.createdAt).getTime());
    const gone = Math.min(total, Math.max(0, Date.now() - new Date(request.createdAt).getTime()));
    return { animationDuration: `${total}ms`, animationDelay: `-${gone}ms` };
  });
  const open = request.status === "pending" && expires > now;
  const careful = /^(Cancel|Reject)\b/.test(request.summary);

  async function decide(decision: Decision) {
    setProblem("");
    setWorking(decision);
    try {
      await onDecide(request, decision);
    } catch {
      if (alive.current)
        setProblem("Couldn't reach Ember just now. Nothing was changed. Try again.");
    } finally {
      if (alive.current) setWorking(null);
    }
  }

  if (request.status === "pending" && !open) return null; // expired: quietly disappears
  if (request.status === "rejected") return null; // "Not now" leaves no clutter behind

  if (!open) {
    const done = request.status === "confirmed";
    const text =
      request.result?.message ??
      (done
        ? "Done."
        : request.status === "stale"
          ? "It changed first, so nothing was changed."
          : "That didn't go through, so nothing was changed.");
    return (
      <p className="mm-ember-act-receipt" data-state={request.status} role="status">
        {done ? (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path className="mm-ember-act-tick" d="M3 8.5l3.2 3.1L13 4.6" fill="none" />
          </svg>
        ) : (
          <span className="mm-ember-act-dot" aria-hidden="true" />
        )}
        <span>
          <span className="mm-ember-act-receipt-main">{request.summary}</span>
          <span className="mm-ember-act-receipt-note"> · {text}</span>
        </span>
      </p>
    );
  }

  return (
    <section
      className="mm-ember-act"
      data-tone={careful ? "careful" : "normal"}
      data-working={working ? "true" : "false"}
      aria-label={`Confirm: ${request.summary}`}
    >
      <p className="mm-ember-act-text">{request.summary}</p>
      {request.preview && <p className="mm-ember-act-preview">{request.preview}</p>}
      <div className="mm-ember-act-buttons">
        <button
          type="button"
          className="mm-ember-act-go"
          disabled={working !== null}
          onClick={() => void decide("confirm")}
        >
          {working === "confirm" ? (
            <>
              <span className="mm-ember-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Working
            </>
          ) : (
            "Confirm"
          )}
        </button>
        <button
          type="button"
          className="mm-ember-act-skip"
          disabled={working !== null}
          onClick={() => void decide("reject")}
        >
          Not now
        </button>
      </div>
      {problem && (
        <p className="mm-ember-act-problem" role="alert">
          {problem}
        </p>
      )}
      <span className="mm-ember-act-timer" aria-hidden="true" style={timer} />
    </section>
  );
}

const THINKING = ["Checking your records…", "Reading the details…", "Putting it together…"];

/** Soft three-dot pulse with a gently cycling status line; static text when motion is reduced. */
export function EmberThinking() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((n) => (n + 1) % THINKING.length), 2600);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="mm-ember-thinking" role="status" aria-live="polite">
      <span className="sr-only">Ember is working on your question</span>
      <span className="mm-ember-dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span key={step} className="mm-ember-thinking-text" aria-hidden="true">
        {THINKING[step]}
      </span>
    </p>
  );
}
