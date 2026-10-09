import { ReactNode } from 'react';
import { ui } from '../../lib/ui';

/** Consistent page header: title, optional description, right-aligned actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className={ui.h2}>{title}</h1>
        {description && <p className={ui.subtitle}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-end gap-2.5">{actions}</div>}
    </header>
  );
}
