"use client";

import { useCallback, useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { StaffReview } from "@/modules/reviews/service";

type Action = "publish_comment" | "hide_comment" | "remove";

export function ReviewsWorkspace({
  organizationId,
  outletId,
  outletName,
}: {
  organizationId: string;
  outletId: string;
  outletName: string;
}) {
  const [items, setItems] = useState<StaffReview[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/reviews`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Reviews are unavailable, or you need manager access.");
      setItems((await response.json()) as StaffReview[]);
      setError("");
    } catch (cause) {
      setItems(null);
      setError(cause instanceof Error ? cause.message : "Reviews are unavailable.");
    }
  }, [url]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function act(review: StaffReview, action: Action) {
    if (busy) return;
    setBusy(review.id);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewId: review.id, action }),
      });
      if (!response.ok) throw new Error("That change could not be saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally {
      setBusy("");
    }
  }

  const pending = items?.filter((review) => review.commentStatus === "pending") ?? [];
  const rest = items?.filter((review) => review.commentStatus !== "pending") ?? [];
  const row = (review: StaffReview) => (
    <li key={review.id} className="panel stack" style={{ gap: "0.4rem" }}>
      <div className="row between" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <strong>{review.dishName}</strong>
        <span
          aria-label={`${review.rating} out of 5 stars`}
          style={{ display: "inline-flex", gap: "0.15rem" }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={15}
              aria-hidden="true"
              fill={n <= review.rating ? "currentColor" : "none"}
            />
          ))}
        </span>
      </div>
      {review.comment ? (
        <p style={{ margin: 0 }}>
          “{review.comment}”{review.name ? ` — ${review.name}` : ""}
        </p>
      ) : (
        <small className="quiet">Star rating only</small>
      )}
      <small className="quiet">
        {new Date(review.createdAt).toLocaleDateString()} · Comment: {review.commentStatus}
      </small>
      <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        {review.comment && review.commentStatus !== "published" && (
          <button
            type="button"
            className="action ember"
            style={{ minHeight: "44px" }}
            disabled={Boolean(busy)}
            onClick={() => act(review, "publish_comment")}
          >
            Approve comment
          </button>
        )}
        {review.comment && review.commentStatus !== "hidden" && (
          <button
            type="button"
            className="action"
            style={{ minHeight: "44px" }}
            disabled={Boolean(busy)}
            onClick={() => act(review, "hide_comment")}
          >
            Hide comment
          </button>
        )}
        <button
          type="button"
          className="action"
          style={{ minHeight: "44px" }}
          disabled={Boolean(busy)}
          onClick={() => act(review, "remove")}
        >
          Remove rating
        </button>
      </div>
    </li>
  );

  return (
    <main className="stack" style={{ gap: "1rem", padding: "1rem", maxWidth: "820px" }}>
      <header>
        <span className="eyebrow">{outletName}</span>
        <h1 style={{ margin: 0 }}>Guest reviews</h1>
        <p className="quiet">
          Ratings come only from guests who ordered the dish. A star rating counts straight away; a
          written comment appears on your public menu only after you approve it. A dish shows stars
          publicly once it has three ratings.
        </p>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {items === null && !error && <p role="status">Loading reviews…</p>}
      {items && items.length === 0 && (
        <p>No reviews yet. They appear after guests rate a served order.</p>
      )}
      {pending.length > 0 && (
        <section aria-labelledby="pending-title" className="stack" style={{ gap: "0.6rem" }}>
          <h2 id="pending-title">Comments waiting for approval ({pending.length})</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {pending.map(row)}
          </ul>
        </section>
      )}
      {rest.length > 0 && (
        <section aria-labelledby="recent-title" className="stack" style={{ gap: "0.6rem" }}>
          <h2 id="recent-title">Recent ratings</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
            {rest.map(row)}
          </ul>
        </section>
      )}
    </main>
  );
}
