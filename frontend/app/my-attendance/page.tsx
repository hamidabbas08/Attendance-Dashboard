'use client';

import { useMemo, useState } from 'react';
import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Record {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function counts(records: Record[]) {
  let present = 0;
  let absent = 0;
  let leave = 0;
  for (const r of records) {
    if (r.status === 'present' || r.status === 'late') present += 1;
    else if (r.status === 'absent') absent += 1;
    else if (r.status === 'leave') leave += 1;
  }
  const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
  return { present, absent, leave, pct };
}

function MyAttendance() {
  const { data } = useFetch<Record[]>('/api/attendance/me');
  const all = data ?? [];
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);

  const years = useMemo(() => {
    const s = new Set<number>([curYear]);
    for (const r of all) s.add(Number(r.date.slice(0, 4)));
    return [...s].sort((a, b) => b - a);
  }, [all, curYear]);

  const yearRecords = useMemo(
    () => all.filter((r) => r.date.startsWith(`${year}-`)),
    [all, year],
  );
  const yearly = counts(yearRecords);
  const byMonth = useMemo(
    () => MONTHS.map((_, i) => counts(yearRecords.filter((r) => Number(r.date.slice(5, 7)) === i + 1))),
    [yearRecords],
  );

  return (
    <>
      <div className="flex items-end justify-between gap-3 mb-4">
        <h2 className={ui.h2}>My Attendance</h2>
        <div>
          <label className={ui.label}>Year</label>
          <select className={ui.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Yearly totals */}
      <div className={ui.grid}>
        <Stat label={`Present in ${year}`} value={yearly.present} tone="text-emerald-300" />
        <Stat label={`Absent in ${year}`} value={yearly.absent} tone="text-danger" />
        <Stat label="On leave" value={yearly.leave} tone="text-blue-300" />
        <Stat label="Attendance %" value={`${yearly.pct}%`} />
      </div>

      {/* Monthly breakdown */}
      <div className={ui.card}>
        <h3 className="font-semibold mb-2">Monthly breakdown — {year}</h3>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Month</th>
              <th className={ui.th}>Present</th>
              <th className={ui.th}>Absent</th>
              <th className={ui.th}>%</th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map((m, i) => (
              <tr key={i}>
                <td className={ui.td}>{MONTHS[i]}</td>
                <td className={`${ui.td} text-emerald-300 font-semibold`}>{m.present}</td>
                <td className={`${ui.td} text-danger font-semibold`}>{m.absent}</td>
                <td className={ui.td}>{m.present + m.absent > 0 ? `${m.pct}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daily records */}
      <div className={ui.card}>
        <h3 className="font-semibold mb-2">Records — {year}</h3>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Date</th>
              <th className={ui.th}>Check in</th>
              <th className={ui.th}>Check out</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...yearRecords].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
              <tr key={r.id}>
                <td className={ui.td}>{r.date}</td>
                <td className={ui.td}>{r.checkIn ?? '—'}</td>
                <td className={ui.td}>{r.checkOut ?? '—'}</td>
                <td className={ui.td}><StatusPill status={r.status} /></td>
              </tr>
            ))}
            {yearRecords.length === 0 && (
              <tr>
                <td className={`${ui.td} text-muted`} colSpan={4}>No attendance records for {year}.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className={ui.card}>
      <div className={`text-3xl font-bold ${tone ?? ''}`}>{value}</div>
      <div className="text-muted text-[13px]">{label}</div>
    </div>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <MyAttendance />
    </Guard>
  );
}
