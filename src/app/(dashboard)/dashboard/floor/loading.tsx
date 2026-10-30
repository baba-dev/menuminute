import { LoadingRegion, SkeletonCard } from "@/components/ui/skeleton";

export default function FloorLoading() {
  return (
    <LoadingRegion label="Loading the dining floor…" className="mm-floor-page">
      <div className="mm-floor-grid" aria-hidden="true">
        <SkeletonCard lines={5} height={320} />
        <SkeletonCard lines={4} height={320} />
      </div>
    </LoadingRegion>
  );
}
