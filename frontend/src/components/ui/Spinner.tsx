/** A small spinning ring, for inline/full-page loading states instead of bare text. */
export function Spinner({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-panel2 border-t-accent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}
