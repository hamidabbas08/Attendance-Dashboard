/** Reusable Tailwind class strings — keeps the JSX tidy and consistent. */
export const ui = {
  card: 'bg-panel border border-line rounded-xl p-5 mb-5',
  btn:
    'bg-accent text-ink font-semibold rounded-lg px-4 py-2.5 cursor-pointer ' +
    'disabled:opacity-60 disabled:cursor-default',
  btnGhost:
    'bg-transparent text-fg border border-line font-semibold rounded-lg px-4 py-2.5 cursor-pointer',
  input: 'bg-panel2 border border-line text-fg rounded-lg px-3 py-2.5 w-full',
  label: 'block text-[13px] text-muted mt-3 mb-1.5',
  th: 'text-left px-3 py-2.5 border-b border-line text-muted font-semibold text-sm',
  td: 'text-left px-3 py-2.5 border-b border-line text-sm',
  table: 'w-full border-collapse',
  h2: 'text-xl font-bold mb-3',
  muted: 'text-muted',
  error: 'text-danger text-sm mt-2.5',
  grid: 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]',
} as const;

/** Pill classes for an attendance status. */
export function pillClass(status: string): string {
  return `pill pill-${status}`;
}
