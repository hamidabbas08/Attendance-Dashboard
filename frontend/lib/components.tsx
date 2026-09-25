'use client';

import { ReactNode } from 'react';
import { useAuth } from './auth';

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${status}`}>{status.replace('_', ' ')}</span>;
}

/** Client-side page guard. UI convenience only — the backend still authorizes. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return <div className="card">403 — You do not have access to this page.</div>;
  }
  return <>{children}</>;
}
