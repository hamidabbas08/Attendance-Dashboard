import { MonthlyBars, PageHeader, SectionCard, StatTile, StatusBars, TableSkeleton, TilesSkeleton } from '../ui';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { attended, Matrix, MONTHS, rate } from './metrics';
import { TopAbsencesTable } from './TopAbsencesTable';

export function CompanyDashboard({ year, name, company }: { year: number; name: string; company: string }) {
  const { data, loading } = useFetch<Matrix>(`/api/reports/attendance/matrix?year=${year}`);

  const header = (
    <PageHeader
      title={`Welcome back${name ? `, ${name.split(' ')[0]}` : ''}`}
      description={`${company ? `${company} · ` : ''}attendance overview for ${year}`}
    />
  );
  if (loading && !data) {
    return (
      <>
        {header}
        <TilesSkeleton count={5} />
        <div className="grid gap-5 lg:grid-cols-3 mb-5">
          <div className="lg:col-span-2"><TableSkeleton rows={4} cols={2} /></div>
          <TableSkeleton rows={4} cols={2} />
        </div>
        <TableSkeleton rows={6} cols={4} />
      </>
    );
  }

  const t = data?.companyTotals;
  const monthly = (data?.companyByMonth ?? []).map((c, i) => ({ label: MONTHS[i], value: rate(c) }));
  const topAbsent = [...(data?.employees ?? [])]
    .filter((e) => e.totals.absent > 0)
    .sort((a, b) => b.totals.absent - a.totals.absent)
    .slice(0, 6);

  return (
    <>
      {header}

      <div className={`${ui.grid} mb-5`}>
        <StatTile label="Employees" value={data?.employees.length ?? 0} accent="#38bdf8" />
        <StatTile label={`Present in ${year}`} value={t ? attended(t) : 0} accent="#34d399" />
        <StatTile label={`Absent in ${year}`} value={t?.absent ?? 0} accent="#f87171" />
        <StatTile label="Late arrivals" value={t?.late ?? 0} accent="#fbbf24" />
        <StatTile label="Attendance rate" value={t ? `${rate(t) ?? 0}%` : '—'} accent="#a78bfa" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <SectionCard
          className="lg:col-span-2"
          title="Attendance rate by month"
          subtitle={`% present of recorded days · ${year}`}
        >
          <MonthlyBars data={monthly} />
        </SectionCard>
        <SectionCard title="Status breakdown">
          <StatusBars counts={(t as unknown as Record<string, number>) ?? {}} />
        </SectionCard>
      </div>

      <TopAbsencesTable year={year} rows={topAbsent} />
    </>
  );
}
