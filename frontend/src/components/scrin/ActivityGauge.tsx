// A small ring gauge for a 0-100 activity level — green/amber/red by
// threshold, mirroring scrin.io's own per-screenshot and per-task indicator
// (it reads as a tiny pie/clock, close enough to a play/pause glyph at this
// size that it's instantly scannable at a glance).
export function ActivityGauge({ level, size = 15 }: { level: number; size?: number }) {
  const color = level >= 66 ? '#34d399' : level >= 33 ? '#fbbf24' : '#f87171';
  const r = (size - 2.5) / 2;
  const c = 2 * Math.PI * r;
  const filled = (Math.max(0, Math.min(100, level)) / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`${level}% active`}>
      <title>{level}% active</title>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={`${filled} ${c - filled}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
