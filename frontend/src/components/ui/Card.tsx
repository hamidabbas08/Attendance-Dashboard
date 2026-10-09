import { ReactNode } from 'react';
import { ui } from '../../lib/ui';

/** A titled content card with an optional header row and actions. */
export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`surface ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-b border-line/70">
          <div className="min-w-0">
            {title && <h3 className={ui.h3}>{title}</h3>}
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={`p-5 sm:p-6 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
