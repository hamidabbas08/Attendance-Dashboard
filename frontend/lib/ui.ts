/** Reusable Tailwind class strings — keeps the JSX tidy and consistent. */
const btnBase =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg px-4 py-2.5 text-sm cursor-pointer ' +
  'transition-[filter,background-color,border-color,box-shadow,transform] duration-150 ' +
  'disabled:opacity-60 disabled:cursor-default';

export const ui = {
  card: 'surface p-5 sm:p-6 mb-5',
  tile: 'surface p-5',
  // Buttons — one family, four intents, shared height/radius/typography.
  btn: `${btnBase} bg-accent text-ink shadow-sm hover:brightness-110 hover:shadow-md active:brightness-95 active:translate-y-px disabled:hover:shadow-sm`,
  btnSecondary: `${btnBase} bg-panel2 text-fg border border-line hover:bg-[#1b2c45] hover:border-[#2b3c57]`,
  btnGhost: `${btnBase} bg-transparent text-muted hover:text-fg hover:bg-white/[0.05]`,
  btnDanger: `${btnBase} bg-danger/90 text-ink hover:brightness-110 active:translate-y-px`,
  input:
    'bg-panel2 border border-line text-fg rounded-lg px-3 py-2.5 text-sm w-full transition-colors duration-150 ' +
    'placeholder:text-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed',
  label: 'block text-[12px] font-medium text-muted mb-1.5',
  // Tables — light separators, comfortable rows, no heavy cell borders.
  th: 'text-left px-4 py-3 border-b border-line text-faint font-semibold text-[11px] uppercase tracking-wider',
  td: 'text-left px-4 py-3 border-b border-line/50 text-sm align-middle',
  table: 'w-full border-collapse',
  // Typography scale.
  h2: 'text-[26px] leading-tight font-bold tracking-tight',
  h3: 'text-[15px] font-semibold',
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
