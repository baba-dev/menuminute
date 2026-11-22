import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function TiffinLoading() {
  return (
    <LoadingRegion label="Loading your tiffin menu…" className="tiffin-shell">
      <div aria-hidden="true">
        <Skeleton height={32} radius={8} />
        <SkeletonCard lines={3} height={160} />
        <SkeletonCard lines={3} height={160} />
      </div>
    </LoadingRegion>
  );
}
