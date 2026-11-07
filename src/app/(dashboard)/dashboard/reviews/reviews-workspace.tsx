"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MessageSquareText, RefreshCw, ShieldCheck, Star, StarOff } from "lucide-react";
import type { StaffReview } from "@/modules/reviews/service";
import "./reviews.css";

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
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/reviews`;

  const load = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(url, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Reviews are unavailable, or you need manager access.");
      setItems((await response.json()) as StaffReview[]);
      setError("");
      return true;
    } catch (cause) {
      setItems(null);
      setError(cause instanceof Error ? cause.message : "Reviews are unavailable.");
      return false;
    }
  }, [url]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function act(review: StaffReview, action: Action) {
    if (busy) return;
    setBusy(review.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reviewId: review.id, action }),
      });
      if (!response.ok) throw new Error("That change could not be saved.");
      if (await load()) setNotice("Review changes saved.");
      setConfirmRemove(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That change could not be saved.");
    } finally {
      setBusy("");
    }
  }

  const pending = items?.filter((review) => review.commentStatus === "pending") ?? [];
  const rest = items?.filter((review) => review.commentStatus !== "pending") ?? [];
  const publishedCount =
    items?.filter((review) => review.commentStatus === "published").length ?? 0;

  function reviewRow(review: StaffReview) {
    return (
      <li key={review.id} className="rr-card">
        <div className="rr-card-heading">
          <div className="rr-card-title">
            <h3>{review.dishName}</h3>
            <span className={`rr-status rr-status--${review.commentStatus}`}>
              {review.commentStatus === "pending"
                ? "Waiting for approval"
                : review.commentStatus === "published"
                  ? "Public comment"
                  : review.commentStatus === "hidden"
                    ? "Hidden comment"
                    : "Rating only"}
            </span>
          </div>
          <span className="rr-stars" aria-label={`${review.rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={17}
                aria-hidden="true"
                fill={n <= review.rating ? "currentColor" : "none"}
              />
            ))}
          </span>
        </div>
        {review.comment ? (
          <blockquote className="rr-comment">
            “{review.comment}”{review.name ? ` — ${review.name}` : ""}
          </blockquote>
        ) : (
          <p className="rr-muted">Star rating only; no written comment.</p>
        )}
        <p className="rr-date">{new Date(review.createdAt).toLocaleDateString()}</p>
        <div className="rr-actions">
          {review.comment && review.commentStatus !== "published" && (
            <button
              type="button"
              className="rr-button rr-button--primary"
              disabled={Boolean(busy)}
              onClick={() => void act(review, "publish_comment")}
            >
              <Check size={16} aria-hidden="true" />
              Approve comment
            </button>
          )}
          {review.comment && review.commentStatus !== "hidden" && (
            <button
              type="button"
              className="rr-button"
              disabled={Boolean(busy)}
              onClick={() => void act(review, "hide_comment")}
            >
              Hide comment
            </button>
          )}
          {confirmRemove === review.id ? (
            <div className="rr-remove-confirm" role="group" aria-label="Confirm rating removal">
              <span>Remove this rating?</span>
              <button
                type="button"
                className="rr-button rr-button--danger"
                disabled={Boolean(busy)}
                onClick={() => void act(review, "remove")}
              >
                Yes, remove
              </button>
              <button
                type="button"
                className="rr-button"
                disabled={Boolean(busy)}
                onClick={() => setConfirmRemove(null)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="rr-button rr-button--quiet"
              disabled={Boolean(busy)}
              onClick={() => setConfirmRemove(review.id)}
            >
              <StarOff size={16} aria-hidden="true" />
              Remove rating
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="rr-workspace">
      <header className="rr-hero">
        <div>
          <span className="rr-eyebrow">GUEST VOICES / {outletName}</span>
          <h1>Reviews, thoughtfully handled.</h1>
          <p>
            Celebrate feedback, moderate written comments and keep ratings trustworthy. Only guests
            who ordered can leave a rating.
          </p>
        </div>
        <div className="rr-hero-art" aria-hidden="true">
          <MessageSquareText size={54} strokeWidth={1.4} />
          <Star size={34} strokeWidth={1.6} />
        </div>
      </header>
      <div className="rr-body">
        <div className="rr-summary" aria-label="Review overview">
          <div>
            <Star size={19} aria-hidden="true" />
            <span>All ratings</span>
            <strong>{items?.length ?? "—"}</strong>
          </div>
          <div>
            <MessageSquareText size={19} aria-hidden="true" />
            <span>Awaiting moderation</span>
            <strong>{items ? pending.length : "—"}</strong>
          </div>
          <div>
            <ShieldCheck size={19} aria-hidden="true" />
            <span>Published comments</span>
            <strong>{items ? publishedCount : "—"}</strong>
          </div>
        </div>
        {error && (
          <div className="rr-alert" role="alert">
            <p>{error}</p>
            <button type="button" className="rr-button" onClick={() => void load()}>
              <RefreshCw size={15} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}
        {notice && (
          <p className="rr-notice" role="status">
            {notice}
          </p>
        )}
        {items === null && !error && (
          <p className="rr-empty" role="status">
            Loading guest reviews…
          </p>
        )}
        {items && items.length === 0 && (
          <section className="rr-empty" aria-label="No reviews">
            <Star size={30} aria-hidden="true" />
            <h2>Your first review starts with a served order.</h2>
            <p>
              Once a guest rates a dish, you can review comments here. Ratings appear publicly after
              the minimum review threshold is reached.
            </p>
          </section>
        )}
        {pending.length > 0 && (
          <section className="rr-section" aria-labelledby="rr-pending-title">
            <div className="rr-section-title">
              <span className="rr-eyebrow">01 / MODERATION</span>
              <h2 id="rr-pending-title">Waiting for approval ({pending.length})</h2>
            </div>
            <ul className="rr-grid">{pending.map(reviewRow)}</ul>
          </section>
        )}
        {rest.length > 0 && (
          <section className="rr-section" aria-labelledby="rr-recent-title">
            <div className="rr-section-title">
              <span className="rr-eyebrow">02 / RECENT FEEDBACK</span>
              <h2 id="rr-recent-title">Recent ratings</h2>
            </div>
            <ul className="rr-grid">{rest.map(reviewRow)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
