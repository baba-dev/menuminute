import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

/** Mirrors the overview: hero, six KPIs, then the 12-column widget grid. */
export default function DashboardLoading() {
  return (
    <LoadingRegion label="Loading your restaurant overview…" className="mm-dashboard product">
      <div className="mm-dashboard-loading-hero" aria-hidden="true">
        <Skeleton className="mm-dashboard-loading-line mm-dashboard-loading-line--heading" />
        <Skeleton className="mm-dashboard-loading-line" />
        <Skeleton className="mm-dashboard-loading-line mm-dashboard-loading-line--button" />
      </div>
      <div className="mm-skeleton-grid" aria-hidden="true">
        <div className="is-wide mm-skeleton-kpis">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} height={115} radius={12} />
          ))}
        </div>
        <SkeletonCard lines={4} height={300} />
        <SkeletonCard lines={4} height={300} />
        <SkeletonCard className="is-wide" lines={4} height={240} />
      </div>
    </LoadingRegion>
  );
}
