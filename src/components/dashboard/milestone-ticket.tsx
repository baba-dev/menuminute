"use client";

import { useEffect, useRef, useState } from "react";
import { ChefHat, X } from "lucide-react";
import type { Milestone } from "@/modules/dashboard/milestones";

const VISIBLE_MS = 15_000;

/**
 * Ink Ticket (treatment B): a sparse, non-modal milestone. It never takes focus, is announced
 * politely once, pauses its timer while hovered or focused, and is static under reduced motion.
 */
export function MilestoneTicket({
  milestone,
  onDismiss,
}: {
  milestone: Milestone;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => dismiss.current(), VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [paused, milestone.id]);

  return (
    <div
      className="mm-ink-ticket"
      role="status"
      aria-live="polite"
      data-testid="milestone-ticket"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="mm-ink-ticket-mark" aria-hidden="true">
        <ChefHat size={22} />
      </span>
      <strong>{milestone.title}</strong>
      <button
        type="button"
        className="mm-icon-button mm-ink-ticket-close"
        aria-label={"Dismiss: " + milestone.title}
        onClick={onDismiss}
      >
        <X size={16} aria-hidden="true" />
      </button>
      <p>{milestone.detail}</p>
    </div>
  );
}
