import { STATUS_META } from '../../lib/ui';

/** A colored status badge (dot + label) driven by the shared status palette. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const meta = STATUS_META[status];
  const text = label ?? meta?.label ?? status.replace('_', ' ');
  const hex = meta?.hex ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ background: `${hex}1f`, color: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: hex }} />
      {text}
    </span>
  );
}
