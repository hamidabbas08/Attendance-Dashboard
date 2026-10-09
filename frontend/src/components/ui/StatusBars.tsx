import { STATUS_META, ui } from '../../lib/ui';

/** Horizontal status distribution bars (reserved status colors + labels). */
export function StatusBars({ counts }: { counts: Record<string, number> }) {
  const keys = ['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'];
  const items = keys
    .map((k) => ({ k, n: counts[k] ?? 0, ...STATUS_META[k] }))
    .filter((i) => i.n > 0);
  const max = Math.max(1, ...items.map((i) => i.n));
  if (items.length === 0) return <p className={ui.muted}>No records yet.</p>;
  return (
    <div className="flex flex-col gap-3.5">
      {items.map((i) => (
        <div key={i.k} className="text-sm">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: i.hex }} />
              {i.label}
            </div>
            <div className={`font-semibold tabular-nums ${i.text}`}>{i.n}</div>
          </div>
          <div className="h-2 rounded-full bg-panel2 overflow-hidden ring-1 ring-white/5">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{ width: `${Math.max((i.n / max) * 100, 4)}%`, background: i.hex }}
              title={`${i.label}: ${i.n}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
