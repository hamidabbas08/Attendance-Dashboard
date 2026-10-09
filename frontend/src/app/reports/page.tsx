'use client';

import { useState } from 'react';
import { getToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Guard, MonthlyBars, PageHeader, SectionCard, Select, StatTile, StatusBars, TableSkeleton, TilesSkeleton } from '../../components/ui';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { Matrix, MONTHS } from '../../components/dashboard/metrics';
import { attended, rate } from '../../components/reports/metrics';
import { ReportsTable } from '../../components/reports/ReportsTable';

function Reports() {
  const { can } = useAuth();
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const { data, loading } = useFetch<Matrix>(`/api/reports/attendance/matrix?year=${year}`);
  const employees = useFetch<{ id: string; avatarUrl?: string | null }[]>('/api/employees');
  const avatarById = new Map((employees.data ?? []).map((e) => [e.id, e.avatarUrl ?? null]));

  const t = data?.companyTotals;
  const monthly = (data?.companyByMonth ?? []).map((c, i) => ({ label: MONTHS[i], value: attended(c) + c.absent > 0 ? rate(c) : null }));
  const rows = [...(data?.employees ?? [])].sort((a, b) => rate(a.totals) - rate(b.totals));

  async function exportCsv() {
    const res = await fetch('/api/reports/attendance.csv', { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Workforce attendance analytics and performance"
        actions={
          <>
            <Select
              label="Year"
              className="!w-auto min-w-[104px] font-medium"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              options={[curYear - 1, curYear, curYear + 1].map((y) => ({ value: y, label: y }))}
            />
            {can('reports:export') && (
              <Button onClick={exportCsv}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
                </svg>
                Export CSV
              </Button>
            )}
          </>
        }
      />

      {loading && !data ? (
        <>
          <TilesSkeleton count={5} />
          <TableSkeleton rows={3} cols={2} />
          <TableSkeleton rows={8} cols={6} />
        </>
      ) : (
      <>
      <div className={`${ui.grid} mb-5`}>
        <StatTile label="Employees" value={data?.employees.length ?? 0} accent="#38bdf8" />
        <StatTile label="Present" value={t ? attended(t) : 0} accent="#34d399" />
        <StatTile label="Absent" value={t?.absent ?? 0} accent="#f87171" />
        <StatTile label="Late" value={t?.late ?? 0} accent="#fbbf24" />
        <StatTile label="Attendance rate" value={t ? `${rate(t)}%` : '—'} accent="#a78bfa" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <SectionCard className="lg:col-span-2" title="Attendance rate by month" subtitle={`% present of recorded days · ${year}`}>
          <MonthlyBars data={monthly} />
        </SectionCard>
        <SectionCard title="Status breakdown">
          <StatusBars counts={(t as unknown as Record<string, number>) ?? {}} />
        </SectionCard>
      </div>

      <SectionCard title="Per-employee summary" subtitle={`${rows.length} people`} bodyClassName="!p-0">
        <ReportsTable rows={rows} avatarById={avatarById} year={year} />
      </SectionCard>
      </>
      )}
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
