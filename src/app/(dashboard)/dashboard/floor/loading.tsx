import { LoadingRegion, SkeletonCard } from "@/components/ui/skeleton";

export default function FloorLoading() {
  return (
    <LoadingRegion label="Loading the dining floor…" className="mm-dashboard product">
      <div className="mm-dashboard-body" aria-hidden="true">
        <SkeletonCard lines={2} height={220} />
        <SkeletonCard lines={4} height={320} />
      </div>
    </LoadingRegion>
  );
}
