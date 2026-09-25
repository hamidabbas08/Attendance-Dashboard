'use client';

import { ReactNode } from 'react';
import { useAuth } from './auth';
import { pillClass } from './ui';

export function StatusPill({ status }: { status: string }) {
  return <span className={pillClass(status)}>{status.replace('_', ' ')}</span>;
}

/** Client-side page guard. UI convenience only — the backend still authorizes. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="bg-panel border border-line rounded-xl p-5 text-danger">
        403 — You do not have access to this page.
      </div>
    );
  }
  return <>{children}</>;
}
