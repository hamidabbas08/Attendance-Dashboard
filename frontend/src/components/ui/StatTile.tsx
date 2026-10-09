/** A KPI tile: accent indicator + label on top, dominant number below. */
export function StatTile({
  label,
  value,
  sub,
  accent = '#38bdf8',
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="surface surface-hover p-5 relative overflow-hidden">
      {/* subtle accent wash in the corner */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full opacity-[0.12] blur-xl"
        style={{ background: accent }}
      />
      <div className="flex items-center gap-2 mb-2.5">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      </div>
      <div className="text-[30px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted/80 mt-1.5">{sub}</div>}
    </div>
  );
}
