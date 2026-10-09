'use client';

import Link from 'next/link';
import { useAuth } from '../lib/auth';
import { EmptyState, MonthlyBars, PageHeader, SectionCard, StatTile, StatusBars, TableSkeleton, TilesSkeleton } from '../lib/components';
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

      <SectionCard
        className="mb-5"
        title={`Most absences · ${year}`}
        actions={<Link href="/reports" className="text-sm font-medium hover:underline">View full report →</Link>}
        bodyClassName={topAbsent.length === 0 ? '!p-0' : '!p-0'}
      >
        {topAbsent.length === 0 ? (
          <EmptyState title="No absences recorded" description={`Nobody has been marked absent in ${year}. Attendance fills in as people check in and out.`} />
        ) : (
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Employee</th>
                  <th className={`${ui.th} text-right`}>Present</th>
                  <th className={`${ui.th} text-right`}>Absent</th>
                  <th className={`${ui.th} text-right`}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {topAbsent.map((e) => (
                  <tr key={e.employeeId} className="transition-colors duration-150 hover:bg-white/[0.025]">
                    <td className={`${ui.td} font-medium`}>
                      <Link href={`/employee/${e.employeeId}`} className="hover:text-accent transition-colors duration-150">
                        {e.name}
                      </Link>
                    </td>
                    <td className={`${ui.td} text-right tabular-nums text-emerald-300 font-semibold`}>{attended(e.totals)}</td>
                    <td className={`${ui.td} text-right tabular-nums text-red-300 font-semibold`}>{e.totals.absent}</td>
                    <td className={`${ui.td} text-right tabular-nums`}>{rate(e.totals) ?? 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}

function EmployeeHome({ name }: { name: string }) {
  const cards = [
    {
      href: '/my-attendance',
      title: 'My Attendance',
      desc: 'Your yearly and monthly present / absent summary.',
      icon: (
        <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 9h18" /><path d="m9 15 2 2 4-4" /></>
      ),
    },
    {
      href: '/my-profile',
      title: 'My Profile',
      desc: 'Your details, role, shift and company.',
      icon: (<><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" /></>),
    },
    {
      href: '/overtime',
      title: 'My Overtime',
      desc: 'Hours worked beyond your assigned shift.',
      icon: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></>),
    },
  ];
  return (
    <>
      <PageHeader
        title={`Welcome back${name ? `, ${name.split(' ')[0]}` : ''}`}
        description="Your personal attendance workspace."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="surface surface-hover p-5 group">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/12 text-accent ring-1 ring-accent/20 mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{c.icon}</svg>
            </span>
            <div className="font-semibold flex items-center gap-1.5">
              {c.title}
              <span className="text-muted opacity-0 group-hover:opacity-100 transition">→</span>
            </div>
            <p className={`${ui.muted} text-sm mt-1`}>{c.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
