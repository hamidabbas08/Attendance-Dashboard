'use client';

import { useState } from 'react';
import { getToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MonthlyBars, StatTile, StatusBars, Guard } from '../../lib/components';
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
  const { data } = useFetch<Matrix>(`/api/reports/attendance/matrix?year=${year}`);

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
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 className={ui.h2}>Reports</h2>
          <p className={ui.subtitle}>Company attendance analytics for {year}</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className={ui.label}>Year</label>
            <select className={ui.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[curYear - 1, curYear, curYear + 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {can('reports:export') && (
            <button className={ui.btn} onClick={exportCsv}>Export CSV</button>
          )}
        </div>
      </header>

      <div className={`${ui.grid} mb-5`}>
        <StatTile label="Employees" value={data?.employees.length ?? 0} accent="#38bdf8" />
        <StatTile label="Present" value={t ? attended(t) : 0} accent="#34d399" />
        <StatTile label="Absent" value={t?.absent ?? 0} accent="#f87171" />
        <StatTile label="Late" value={t?.late ?? 0} accent="#fbbf24" />
        <StatTile label="Attendance rate" value={t ? `${rate(t)}%` : '—'} accent="#a78bfa" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3 mb-5">
        <div className="surface p-5 lg:col-span-2">
          <h3 className="font-semibold mb-3">Attendance rate by month</h3>
          <MonthlyBars data={monthly} />
        </div>
        <div className="surface p-5">
          <h3 className="font-semibold mb-3">Status breakdown</h3>
          <StatusBars counts={(t as unknown as Record<string, number>) ?? {}} />
        </div>
      </div>

      <div className="surface p-5 overflow-x-auto">
        <h3 className="font-semibold mb-3">Per-employee summary</h3>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Employee</th>
              <th className={ui.th}>Present</th>
              <th className={ui.th}>Late</th>
              <th className={ui.th}>Absent</th>
              <th className={ui.th}>Leave</th>
              <th className={ui.th}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.employeeId}>
                <td className={`${ui.td} whitespace-nowrap`}>{e.name}</td>
                <td className={`${ui.td} text-emerald-300 font-semibold`}>{attended(e.totals)}</td>
                <td className={`${ui.td} text-amber-300`}>{e.totals.late}</td>
                <td className={`${ui.td} text-red-300 font-semibold`}>{e.totals.absent}</td>
                <td className={`${ui.td} text-blue-300`}>{e.totals.leave}</td>
                <td className={ui.td}>
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
    </>
  );
}

function RateBadge({ value }: { value: number }) {
  const tone = value >= 90 ? 'bg-emerald-500/15 text-emerald-300'
    : value >= 75 ? 'bg-amber-500/15 text-amber-300'
    : 'bg-red-500/20 text-red-300';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tone}`}>{value}%</span>;
}

export default function Page() {
  return (
    <Guard perm={P.REPORTS_VIEW}>
      <Reports />
    </Guard>
  );
}
