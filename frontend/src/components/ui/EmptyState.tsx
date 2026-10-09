import { ReactNode } from 'react';

/** A polished empty state: icon, heading, description, optional action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-panel2 text-muted ring-1 ring-line">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-5 w-5">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="font-semibold">{title}</div>
      {description && <p className="text-sm text-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
