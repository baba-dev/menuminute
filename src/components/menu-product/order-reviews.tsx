"use client";
import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { ReviewLine, ReviewState } from "@/modules/reviews/service";

function Stars({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "flex", gap: "0.15rem" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={() => onChange(n)}
          style={{
            minHeight: "44px",
            minWidth: "44px",
            border: 0,
            background: "transparent",
            color: n <= value ? "var(--dc-ember, #a93608)" : "var(--dc-line, #cbb)",
          }}
        >
          <Star size={26} aria-hidden="true" fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function Line({
  line,
  onSubmit,
  disabled,
}: {
  line: ReviewLine;
  onSubmit: (line: ReviewLine, rating: number, comment: string, name: string) => Promise<void>;
  disabled: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  if (line.rating) {
    return (
      <li className="stack" style={{ gap: "0.2rem" }}>
        <strong>{line.name}</strong>
        <span role="status">
          Thanks, you rated this {line.rating} out of 5
          {line.commentStatus === "pending"
            ? ". Your comment is awaiting the restaurant's approval."
            : "."}
        </span>
      </li>
    );
  }
  return (
    <li className="stack" style={{ gap: "0.4rem" }}>
      <strong>{line.name}</strong>
      <Stars value={rating} onChange={setRating} label={`Rate ${line.name}`} />
      {rating > 0 && (
        <>
          <label className="stack" style={{ gap: "0.2rem" }}>
            <span>Comment (optional, shown only after the restaurant approves it)</span>
            <textarea
              className="field-input"
              rows={2}
              maxLength={400}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {comment.trim() && (
            <label className="stack" style={{ gap: "0.2rem" }}>
              <span>Name to show (optional)</span>
              <input
                className="field-input"
                maxLength={40}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <button
            type="button"
            className="action ember"
            style={{ minHeight: "44px", alignSelf: "start" }}
            disabled={busy || disabled}
            onClick={async () => {
              setBusy(true);
              try {
                await onSubmit(line, rating, comment, name);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Sending…" : "Send rating"}
          </button>
        </>
      )}
    </li>
  );
}

/** Shown once an order is served or collected. Only the order's own tracking capability can rate. */
export function OrderReviews({
  token,
  orderId,
  capability,
}: {
  token: string;
  orderId: string;
  capability: string;
}) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [error, setError] = useState("");
  const url = `/api/public-orders/${encodeURIComponent(orderId)}/reviews`;
  const load = useCallback(async () => {
    try {
      const response = await fetch(`${url}?token=${encodeURIComponent(token)}`, {
        cache: "no-store",
        headers: { "x-tracking-token": capability },
      });
      if (!response.ok) return;
      setState((await response.json()) as ReviewState);
    } catch {
      /* ratings are optional; stay quiet if unavailable */
    }
  }, [url, token, capability]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function submit(line: ReviewLine, rating: number, comment: string, name: string) {
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          trackingToken: capability,
          orderItemId: line.orderItemId,
          rating,
          comment,
          name,
        }),
      });
      if (!response.ok) throw new Error("Your rating could not be saved. Please try again.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your rating could not be saved.");
    }
  }

  if (!state?.eligible) return null;
  return (
    <section className="panel stack" aria-labelledby="rate-dishes-title" style={{ gap: "0.8rem" }}>
      <h2 id="rate-dishes-title" style={{ margin: 0 }}>
        How was your meal?
      </h2>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "1rem" }}>
        {state.items.map((line) => (
          <Line key={line.orderItemId} line={line} onSubmit={submit} disabled={false} />
        ))}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
