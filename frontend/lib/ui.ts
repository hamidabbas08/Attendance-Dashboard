/** Reusable Tailwind class strings — keeps the JSX tidy and consistent. */
export const ui = {
  card: 'surface p-5 sm:p-6 mb-5',
  tile: 'surface p-5',
  btn:
    'inline-flex items-center justify-center gap-2 bg-accent text-ink font-semibold rounded-lg px-4 py-2.5 ' +
    'cursor-pointer transition-[filter,box-shadow,transform] duration-150 shadow-sm ' +
    'hover:brightness-110 hover:shadow-md active:brightness-95 active:translate-y-px ' +
    'disabled:opacity-60 disabled:cursor-default disabled:hover:shadow-sm',
  btnGhost:
    'inline-flex items-center justify-center gap-2 bg-transparent text-fg border border-line font-semibold ' +
    'rounded-lg px-4 py-2.5 cursor-pointer transition-colors duration-150 hover:bg-panel2 hover:border-line/80',
  input:
    'bg-panel2 border border-line text-fg rounded-lg px-3 py-2.5 w-full transition-colors duration-150 ' +
    'placeholder:text-muted/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30',
  label: 'block text-[13px] font-medium text-muted mt-3 mb-1.5',
  th: 'text-left px-3 py-2.5 border-b border-line text-muted font-semibold text-[11px] uppercase tracking-wider',
  td: 'text-left px-3 py-3 border-b border-line/50 text-sm',
  table: 'w-full border-collapse',
  h2: 'text-[26px] leading-tight font-bold tracking-tight',
  subtitle: 'text-muted text-sm mt-1',
  muted: 'text-muted',
  error: 'text-danger text-sm mt-2.5',
  grid: 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]',
} as const;

/** Pill classes for an attendance status. */
export function pillClass(status: string): string {
  return `pill pill-${status}`;
}

/** Format a stored 24h "HH:MM" as 12-hour with AM/PM, e.g. "16:05" → "4:05 PM". */
export function to12h(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m[2]} ${ap}`;
}

/** Status → { label, color } for tiles, bars and legends. */
export const STATUS_META: Record<string, { label: string; hex: string; text: string }> = {
  present: { label: 'Present', hex: '#34d399', text: 'text-emerald-300' },
  late: { label: 'Late', hex: '#fbbf24', text: 'text-amber-300' },
  absent: { label: 'Absent', hex: '#f87171', text: 'text-red-300' },
  leave: { label: 'Leave', hex: '#60a5fa', text: 'text-blue-300' },
  half_day: { label: 'Half day', hex: '#f59e0b', text: 'text-amber-300' },
  off_day: { label: 'Off day', hex: '#64748b', text: 'text-slate-300' },
  holiday: { label: 'Holiday', hex: '#818cf8', text: 'text-indigo-300' },
};
