// Four equal-width quartile bars as the per-screenshot activity readout, lit
// left to right by how many 25%-quartiles the level clears (so 100% lights
// all four). All lit bars share one color — green/amber/red by the same
// threshold as ActivityGauge — rather than a fixed rainbow per position.
// Keyed to the filled bar count itself (not a separate threshold on the raw
// level) so the color always matches what's on screen — two cards both
// showing 3 bars could otherwise land on opposite sides of an independent
// threshold and end up different colors for the same bar count.
const BAR_COLOR_BY_FILLED = ['#f87171', '#fb923c', '#fbbf24', '#34d399'];

export function ActivityBars({ level }: { level: number }) {
  const clamped = Math.max(0, Math.min(100, level));
  const filled = clamped <= 0 ? 0 : Math.max(1, Math.round(clamped / 25));
  const color = BAR_COLOR_BY_FILLED[filled - 1] ?? BAR_COLOR_BY_FILLED[0];
  return (
    <div className="flex items-center gap-0.5 w-full" title={`${level}% active`}>
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-sm transition-colors"
          style={{ backgroundColor: i < filled ? color : 'rgba(255,255,255,0.1)' }}
        />
      ))}
    </div>
  );
}
