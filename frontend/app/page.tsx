'use client';

import { useAuth } from '../lib/auth';
import { P } from '../lib/permissions';
import { ui } from '../lib/ui';
import { useFetch } from '../lib/useFetch';

interface Report {
  total: number;
  byStatus: Record<string, number>;
}

export default function DashboardPage() {
  const { me, can } = useAuth();
  const canReport = can(P.REPORTS_VIEW);
  const { data } = useFetch<Report>(canReport ? '/api/reports/attendance' : '/api/auth/me');

  return (
    <>
      <h2 className={ui.h2}>Dashboard</h2>
      <p className={ui.muted}>
        Signed in as {me?.roles.join(', ')}
        {me?.companyId ? ` · company ${me.companyId.slice(0, 8)}…` : ' · platform'}
      </p>

      {canReport && data && 'byStatus' in data ? (
        <div className={`${ui.grid} mt-4`}>
          <Stat label="Total records" value={(data as Report).total} />
          {Object.entries((data as Report).byStatus).map(([k, v]) => (
            <Stat key={k} label={k.replace('_', ' ')} value={v} />
          ))}
        </div>
      ) : (
        <div className={`${ui.card} mt-4`}>
          <p>Welcome. Use the navigation to view your attendance and profile.</p>
          <p className={ui.muted}>
            Your available features are determined by your role — and enforced by the
            backend on every request.
          </p>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={ui.card}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-muted text-[13px] capitalize">{label}</div>
    </div>
  );
}
