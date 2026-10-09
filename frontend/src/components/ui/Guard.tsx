import { ReactNode } from 'react';
import { useAuth } from '../../lib/auth';

/** Client-side page guard. UI convenience only — the backend still authorizes. */
export function Guard({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(perm)) {
    return (
      <div className="surface p-5 text-danger">403 — You do not have access to this page.</div>
    );
  }
  return <>{children}</>;
}
