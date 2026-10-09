import { ReactNode } from 'react';

/** A compact segmented control (used for filter tabs). */
export function SegTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-panel2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-accent text-ink shadow-sm' : 'text-muted hover:text-fg hover:bg-white/[0.05]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
