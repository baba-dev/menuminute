"use client";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import type { PublicReview } from "@/modules/reviews/service";

/** Approved diner comments for one dish. Renders nothing until there is something approved to show. */
export function DishReviewsList({ token, dishId }: { token: string; dishId: string }) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  useEffect(() => {
    let active = true;
    void fetch(
      `/api/public-menu/${encodeURIComponent(token)}/reviews?dish=${encodeURIComponent(dishId)}`
    )
      .then((response) => (response.ok ? response.json() : []))
      .then((list: PublicReview[]) => active && Array.isArray(list) && setReviews(list))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, dishId]);
  if (reviews.length === 0) return null;
  return (
    <section className="dining-reviews" aria-label="What diners say">
      <h3 style={{ fontSize: "1rem", margin: "0 0 0.5rem" }}>What diners say</h3>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
        {reviews.map((review, index) => (
          <li key={index} className="stack" style={{ gap: "0.15rem" }}>
            <span className="dining-rating" aria-label={`${review.rating} out of 5 stars`}>
              <Star size={13} aria-hidden="true" fill="currentColor" />
              <span aria-hidden="true">{review.rating}</span>
              {review.name && <small>· {review.name}</small>}
            </span>
            <span style={{ fontSize: "0.9rem" }}>{review.comment}</span>
          </li>
        ))}
      </ul>
      <small className="quiet">
        Comments are from verified orders and approved by the restaurant.
      </small>
    </section>
  );
}
