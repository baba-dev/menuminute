import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Date bar, tab strip, four KPI cards and two chart panels. */
export default function ReportsLoading() {
  return (
    <LoadingRegion label="Loading reports…" className="mm-skeleton-page">
      <Skeleton height={40} width="min(360px, 80%)" />
      <Skeleton height={44} radius={100} />
      <div
        className="mm-skeleton-kpis"
        aria-hidden="true"
        style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={110} radius={12} />
        ))}
      </div>
      <div className="mm-skeleton-grid" style={{ padding: 0 }} aria-hidden="true">
        <SkeletonCard lines={5} height={320} />
        <SkeletonCard lines={5} height={320} />
      </div>
    </LoadingRegion>
  );
}
