import type { CSSProperties } from "react";

/**
 * Static, layout-reserving placeholders. No looping shimmer (see docs/feedback-and-motion.md):
 * they fade in once after a short delay so fast loads never flash a loader.
 */
export function Skeleton({
  width,
  height,
  radius,
  className = "",
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  className?: string;
}) {
  const style: CSSProperties = { width, height, borderRadius: radius };
  return <span aria-hidden="true" className={"mm-skeleton " + className} style={style} />;
}

/** A card-shaped group of lines that mirrors the real dashboard panels. */
export function SkeletonCard({
  lines = 3,
  height,
  className = "",
}: {
  lines?: number;
  height?: number | string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={"mm-skeleton-card " + className}
      style={{ minHeight: height }}
    >
      <Skeleton height={12} width="32%" />
      <Skeleton height={26} width="64%" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={14} width={index === lines - 1 ? "48%" : "100%"} />
      ))}
    </div>
  );
}

/** One polite announcement per route; the visual placeholders stay hidden from assistive tech. */
export function LoadingRegion({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
