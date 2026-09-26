'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { MonthlyBars, StatTile, StatusBars, TableSkeleton, TilesSkeleton } from '../lib/components';
import { P } from '../lib/permissions';
import { ui } from '../lib/ui';
import { useFetch } from '../lib/useFetch';

interface Counts {
  present: number; late: number; absent: number; leave: number;
  half_day: number; off_day: number; holiday: number; total: number;
}
interface EmpRow { employeeId: string; name: string; totals: Counts }
interface Matrix {
  year: number;
  employees: EmpRow[];
  companyByMonth: Counts[];
  companyTotals: Counts;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const attended = (c: Counts) => c.present + c.late;
const rate = (c: Counts) => (attended(c) + c.absent > 0 ? Math.round((attended(c) / (attended(c) + c.absent)) * 100) : null);

export default function DashboardPage() {
  const { me, can } = useAuth();
  const year = new Date().getUTCFullYear();

  if (!can(P.REPORTS_VIEW)) return <EmployeeHome name={me?.name ?? ''} />;
  return <CompanyDashboard year={year} name={me?.name ?? ''} company={me?.companyName ?? ''} />;
}

function CompanyDashboard({ year, name, company }: { year: number; name: string; company: string }) {
  const { data, loading } = useFetch<Matrix>(`/api/reports/attendance/matrix?year=${year}`);

  const header = (
    <header className="mb-6">
      <h2 className={ui.h2}>Welcome back{name ? `, ${name.split(' ')[0]}` : ''} 👋</h2>
      <p className={ui.subtitle}>{company} · attendance overview for {year}</p>
    </header>
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
        <div className="surface p-5 lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-semibold">Attendance rate by month</h3>
            <span className="text-xs text-muted">% present of recorded days · {year}</span>
          </div>
          <MonthlyBars data={monthly} />
        </div>
        <div className="surface p-5">
          <h3 className="font-semibold mb-3">Status breakdown</h3>
          <StatusBars counts={(t as unknown as Record<string, number>) ?? {}} />
        </div>
      </div>

      <div className="surface p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Most absences ({year})</h3>
          <Link href="/reports" className="text-sm">View full report →</Link>
        </div>
        {topAbsent.length === 0 ? (
          <p className={ui.muted}>No absences recorded yet.</p>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Employee</th>
                <th className={ui.th}>Present</th>
                <th className={ui.th}>Absent</th>
                <th className={ui.th}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {topAbsent.map((e) => (
                <tr key={e.employeeId}>
                  <td className={ui.td}>{e.name}</td>
                  <td className={`${ui.td} text-emerald-300 font-semibold`}>{attended(e.totals)}</td>
                  <td className={`${ui.td} text-red-300 font-semibold`}>{e.totals.absent}</td>
                  <td className={ui.td}>{rate(e.totals) ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function EmployeeHome({ name }: { name: string }) {
  return (
    <>
      <header className="mb-6">
        <h2 className={ui.h2}>Welcome back{name ? `, ${name.split(' ')[0]}` : ''} 👋</h2>
        <p className={ui.subtitle}>Here&apos;s where you can review your own attendance.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
        <Link href="/my-attendance" className="surface p-6 hover:brightness-110 transition">
          <div className="text-2xl mb-1">🗓️</div>
          <div className="font-semibold">My Attendance</div>
          <p className={`${ui.muted} text-sm`}>Your yearly and monthly present/absent summary.</p>
        </Link>
        <Link href="/my-profile" className="surface p-6 hover:brightness-110 transition">
          <div className="text-2xl mb-1">👤</div>
          <div className="font-semibold">My Profile</div>
          <p className={`${ui.muted} text-sm`}>Your details, role and company.</p>
        </Link>
      </div>
    </>
  );
}
