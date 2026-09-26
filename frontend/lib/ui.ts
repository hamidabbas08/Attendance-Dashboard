/** Reusable Tailwind class strings — keeps the JSX tidy and consistent. */
export const ui = {
  card: 'surface p-5 mb-5',
  tile: 'surface p-5',
  btn:
    'bg-accent text-ink font-semibold rounded-lg px-4 py-2.5 cursor-pointer transition ' +
    'hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-default',
  btnGhost:
    'bg-transparent text-fg border border-line font-semibold rounded-lg px-4 py-2.5 cursor-pointer ' +
    'transition hover:bg-panel2',
  input:
    'bg-panel2 border border-line text-fg rounded-lg px-3 py-2.5 w-full transition ' +
    'focus:outline-none focus:border-accent',
  label: 'block text-[13px] text-muted mt-3 mb-1.5',
  th: 'text-left px-3 py-2.5 border-b border-line text-muted font-semibold text-xs uppercase tracking-wide',
  td: 'text-left px-3 py-2.5 border-b border-line/60 text-sm',
  table: 'w-full border-collapse',
  h2: 'text-2xl font-bold',
  subtitle: 'text-muted text-sm',
  muted: 'text-muted',
  error: 'text-danger text-sm mt-2.5',
  grid: 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]',
} as const;

/** Pill classes for an attendance status. */
export function pillClass(status: string): string {
  return `pill pill-${status}`;
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
