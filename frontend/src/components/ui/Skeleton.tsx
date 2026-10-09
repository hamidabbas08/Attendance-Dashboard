/** Shimmer placeholder. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-panel2/70 ${className}`} />;
}
