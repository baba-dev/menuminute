import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

/**
 * Ink & Ember public UI contracts: one visual system, not parallel button/dialog libraries.
 * Success is always reported by the owning feature after its authoritative operation commits.
 */
export type EmberIntent = "flow" | "press" | "quiet" | "danger";

export function EmberButton({
  intent = "flow",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { intent?: EmberIntent }) {
  return (
    <button
      {...props}
      type={type}
      className={`mm-action mm-action--${intent} ${className}`.trim()}
    />
  );
}

/** Routine forms and decisions: no automatic success or destructive confirmation. */
export function ServiceCard({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`mm-service-card ${className}`.trim()} />;
}

/** Reserve the ticket treatment for first publication and other real milestones. */
export function InkTicket({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`mm-ink-ticket ${className}`.trim()} />;
}

/** Optional, dismissible guidance only; never error, price or mandatory instructions. */
export function ChefNote({
  className = "",
  ...props
}: HTMLAttributes<HTMLElement>) {
  return <aside {...props} className={`mm-chef-note ${className}`.trim()} />;
}
