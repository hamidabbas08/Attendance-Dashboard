import { Skeleton } from './Skeleton';

/** A grid of KPI-tile skeletons. */
export function TilesSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid gap-4 mb-5 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface p-5">
          <Skeleton className="h-2.5 w-20 mb-3" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
