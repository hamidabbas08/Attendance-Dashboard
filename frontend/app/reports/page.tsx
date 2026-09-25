'use client';

import { getToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';

interface Report {
  total: number;
  byStatus: Record<string, number>;
}

function Reports() {
  const { can } = useAuth();
  const { data } = useFetch<Report>('/api/reports/attendance');

  async function exportCsv() {
    // Export uses the same bearer token; the backend gates on reports:export.
    const res = await fetch('/api/reports/attendance.csv', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="topbar">
        <h2>Reports</h2>
        {can('reports:export') && <button onClick={exportCsv}>Export CSV</button>}
      </div>
      <div className="card">
        <div className="grid">
          {data &&
            Object.entries(data.byStatus).map(([k, v]) => (
              <div className="card" key={k}>
                <div className="stat">{v}</div>
                <div className="stat-label">
                  <StatusPill status={k} />
                </div>
              </div>
            ))}
        </div>
        <p className="muted">Total records: {data?.total ?? 0}</p>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.REPORTS_VIEW}>
      <Reports />
    </Guard>
  );
}
