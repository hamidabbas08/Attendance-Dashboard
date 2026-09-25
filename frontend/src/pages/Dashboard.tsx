import { useAuth } from '../auth';
import { P } from '../permissions';
import { useFetch } from '../useFetch';

interface Report {
  total: number;
  byStatus: Record<string, number>;
}

export function Dashboard() {
  const { me, can } = useAuth();
  const canReport = can(P.REPORTS_VIEW);
  const { data } = useFetch<Report>(canReport ? '/api/reports/attendance' : '/api/auth/me');

  return (
    <>
      <h2>Dashboard</h2>
      <p className="muted">
        Signed in as {me?.roles.join(', ')}
        {me?.companyId ? ` · company ${me.companyId.slice(0, 8)}…` : ' · platform'}
      </p>

      {canReport && data && 'byStatus' in data ? (
        <div className="grid">
          <Stat label="Total records" value={(data as Report).total} />
          {Object.entries((data as Report).byStatus).map(([k, v]) => (
            <Stat key={k} label={k.replace('_', ' ')} value={v} />
          ))}
        </div>
      ) : (
        <div className="card">
          <p>Welcome. Use the navigation to view your attendance and profile.</p>
          <p className="muted">
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
    <div className="card">
      <div className="stat">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
