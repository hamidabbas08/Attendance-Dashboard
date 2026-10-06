'use client';

import Link from 'next/link';
import { useState } from 'react';
import { getToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, MonthlyBars, StatTile, StatusBars, Guard, TableSkeleton, TilesSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

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
const rate = (c: Counts) => (attended(c) + c.absent > 0 ? Math.round((attended(c) / (attended(c) + c.absent)) * 100) : 0);

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
      <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className={ui.h2}>Reports</h2>
          <p className={ui.subtitle}>Attendance analytics and workforce performance</p>
        </div>
        <div className="flex items-end gap-2.5">
          <div>
            <label className={ui.label}>Year</label>
            <select className={`${ui.input} !w-auto min-w-[104px] font-medium`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[curYear - 1, curYear, curYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {can('reports:export') && (
            <button className={ui.btn} onClick={exportCsv}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </header>

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
        <div className="surface p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-[15px] font-semibold mb-4">Attendance rate by month</h3>
          <MonthlyBars data={monthly} />
        </div>
        <div className="surface p-5 sm:p-6">
          <h3 className="text-[15px] font-semibold mb-4">Status breakdown</h3>
          <StatusBars counts={(t as unknown as Record<string, number>) ?? {}} />
        </div>
      </div>

      <div className="surface p-5 sm:p-6">
        <h3 className="text-[15px] font-semibold mb-4">Per-employee summary</h3>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Employee</th>
                <th className={`${ui.th} text-right`}>Present</th>
                <th className={`${ui.th} text-right`}>Late</th>
                <th className={`${ui.th} text-right`}>Absent</th>
                <th className={`${ui.th} text-right`}>Leave</th>
                <th className={`${ui.th} text-right`}>Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.employeeId} className="transition-colors duration-150 hover:bg-white/[0.025]">
                  <td className={`${ui.td} whitespace-nowrap`}>
                    <div className="flex items-center gap-2.5">
                      <Avatar src={avatarById.get(e.employeeId)} name={e.name} size={30} />
                      <Link href={`/employee/${e.employeeId}`} className="font-medium hover:text-accent transition-colors duration-150">
                        {e.name}
                      </Link>
                    </div>
                  </td>
                  <td className={`${ui.td} text-right tabular-nums text-emerald-300 font-semibold`}>{attended(e.totals)}</td>
                  <td className={`${ui.td} text-right tabular-nums text-amber-300`}>{e.totals.late}</td>
                  <td className={`${ui.td} text-right tabular-nums text-red-300 font-semibold`}>{e.totals.absent}</td>
                  <td className={`${ui.td} text-right tabular-nums text-blue-300`}>{e.totals.leave}</td>
                  <td className={`${ui.td} text-right`}>
                    <RateBadge value={rate(e.totals)} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td className={`${ui.td} text-muted`} colSpan={6}>No data for {year}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </>
  );
}

function RateBadge({ value }: { value: number }) {
  const tone = value >= 90 ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20'
    : value >= 75 ? 'bg-amber-500/15 text-amber-300 ring-amber-400/20'
    : 'bg-red-500/15 text-red-300 ring-red-400/20';
  const dot = value >= 90 ? 'bg-emerald-400' : value >= 75 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ring-1 ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {value}%
    </span>
  );
}

export default function Page() {
  return (
    <Guard perm={P.REPORTS_VIEW}>
      <Reports />
    </Guard>
  );
}
