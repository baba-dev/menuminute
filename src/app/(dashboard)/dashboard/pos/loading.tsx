import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Catalog on the left, current ticket on the right, as in the Till. */
export default function PosLoading() {
  return (
    <LoadingRegion label="Loading Point of Sale…" className="mm-skeleton-page">
      <Skeleton height={44} width="min(420px, 70%)" radius={100} />
      <div className="mm-skeleton-grid" style={{ padding: 0 }} aria-hidden="true">
        <div style={{ gridColumn: "span 8", display: "grid", gap: 14 }}>
          <Skeleton height={44} radius={12} />
          <div className="mm-skeleton-kpis">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} height={140} radius={12} />
            ))}
          </div>
        </div>
        <SkeletonCard lines={6} height={420} className="mm-skeleton-ticket" />
      </div>
    </LoadingRegion>
  );
}
