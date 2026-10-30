import { LoadingRegion, Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function OrganizationLoading() {
  return (
    <LoadingRegion label="Loading organization and access…" className="mm-skeleton-page">
      <Skeleton height={40} width="min(380px, 80%)" />
      <SkeletonCard lines={3} height={150} />
      <SkeletonCard lines={5} height={260} />
    </LoadingRegion>
  );
}
