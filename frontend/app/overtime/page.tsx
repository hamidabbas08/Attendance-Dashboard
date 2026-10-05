'use client';

import { Fragment, useMemo, useState } from 'react';
import { Guard, StatTile, TableSkeleton, TilesSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  status: string;
}
interface Record {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Standard shift length (hours, start → end incl. break). Overtime is any time
// present beyond this. From 2026-10-05 shifts are 9h (8 work + 1 break); before
// that the schedule was 12h. See the HR policy (Oct 2026).
const NEW_SHIFT_FROM = '2026-10-05';
function shiftHoursFor(date: string): number {
  return date >= NEW_SHIFT_FROM ? 9 : 12;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}
/** Hours between check-in and check-out, treating checkout ≤ checkin as overnight. */
function elapsedHours(checkIn: string, checkOut: string): number {
  const a = parseHM(checkIn);
  let b = parseHM(checkOut);
  if (b <= a) b += 24;
  return b - a;
}
function overtimeOf(rec: Record): number {
  if (!rec.checkIn || !rec.checkOut) return 0;
  return Math.max(0, elapsedHours(rec.checkIn, rec.checkOut) - shiftHoursFor(rec.date));
}
function fmtH(h: number): string {
  if (h <= 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

interface Row {
  employee: Employee;
  totalOt: number;
  totalWorked: number;
  daysWithTimes: number;
  otDays: { date: string; checkIn: string; checkOut: string; worked: number; ot: number }[];
}

function Overtime() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());
  const [open, setOpen] = useState<string | null>(null);

  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  const to =
    month === 'all'
      ? `${year}-12-31`
      : `${year}-${pad(month + 1)}-${pad(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`;

  const employees = useFetch<Employee[]>('/api/employees');
  const attendance = useFetch<Record[]>(`/api/attendance?from=${from}&to=${to}`);

  const rows = useMemo<Row[]>(() => {
    const byEmp = new Map<string, Record[]>();
    for (const r of attendance.data ?? []) {
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
      byEmp.get(r.employeeId)!.push(r);
    }
    const out: Row[] = [];
    for (const e of employees.data ?? []) {
      const recs = byEmp.get(e.id) ?? [];
      const timed = recs.filter((r) => r.checkIn && r.checkOut);
      if (timed.length === 0) continue; // only people with recorded times
      let totalOt = 0;
      let totalWorked = 0;
      const otDays: Row['otDays'] = [];
      for (const r of timed) {
        const worked = elapsedHours(r.checkIn!, r.checkOut!);
        const ot = overtimeOf(r);
        totalWorked += worked;
        totalOt += ot;
        if (ot > 0) otDays.push({ date: r.date, checkIn: r.checkIn!, checkOut: r.checkOut!, worked, ot });
      }
      otDays.sort((a, b) => b.ot - a.ot);
      out.push({ employee: e, totalOt, totalWorked, daysWithTimes: timed.length, otDays });
    }
    return out.sort((a, b) => b.totalOt - a.totalOt);
  }, [attendance.data, employees.data]);

  const loading = (attendance.loading && !attendance.data) || (employees.loading && !employees.data);
  const grandOt = rows.reduce((s, r) => s + r.totalOt, 0);
  const peopleWithOt = rows.filter((r) => r.totalOt > 0).length;
  const maxOt = Math.max(1, ...rows.map((r) => r.totalOt));
  const period = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className={ui.h2}>Overtime</h2>
          <p className={ui.subtitle}>Hours worked beyond the standard shift</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className={ui.label}>Year</label>
            <select className={ui.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[curYear - 1, curYear, curYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={ui.label}>Month</label>
            <select
              className={ui.input}
              value={month}
              onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">Full year</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <>
          <div className={`${ui.grid} mb-5`}><TilesSkeleton count={3} /></div>
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
        <>
          <div className={`${ui.grid} mb-5`}>
            <StatTile label={`Total overtime · ${period}`} value={fmtH(grandOt)} accent="#f59e0b" />
            <StatTile label="People with overtime" value={peopleWithOt} accent="#38bdf8" />
            <StatTile
              label="Avg per person (with OT)"
              value={fmtH(peopleWithOt ? grandOt / peopleWithOt : 0)}
              accent="#a78bfa"
            />
          </div>

          <div className="surface p-5 overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Employee</th>
                  <th className={ui.th}>Days logged</th>
                  <th className={ui.th}>Total worked</th>
                  <th className={ui.th}>Overtime</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.employee.id}>
                    <tr
                      className={r.otDays.length ? 'cursor-pointer hover:bg-panel2/50' : ''}
                      onClick={() => r.otDays.length && setOpen(open === r.employee.id ? null : r.employee.id)}
                    >
                      <td className={`${ui.td} whitespace-nowrap`}>
                        {r.otDays.length > 0 && (
                          <span className="text-muted mr-1">{open === r.employee.id ? '▾' : '▸'}</span>
                        )}
                        {r.employee.name}
                      </td>
                      <td className={ui.td}>{r.daysWithTimes}</td>
                      <td className={ui.td}>{fmtH(r.totalWorked)}</td>
                      <td className={ui.td}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-amber-400/80" style={{ width: `${(r.totalOt / maxOt) * 120}px` }} />
                          <span className={r.totalOt > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}>
                            {fmtH(r.totalOt)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {open === r.employee.id && r.otDays.length > 0 && (
                      <tr>
                        <td className={`${ui.td} bg-panel2/30`} colSpan={4}>
                          <div className="text-xs">
                            <div className="text-muted mb-2">Overtime days — standard shift {shiftHoursFor(from)}h:</div>
                            <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
                              {r.otDays.map((d) => (
                                <div key={d.date} className="flex justify-between gap-3 border border-line rounded px-2 py-1">
                                  <span>{d.date}</span>
                                  <span className="text-muted">{d.checkIn}–{d.checkOut}</span>
                                  <span className="text-amber-300 font-semibold">+{fmtH(d.ot)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className={`${ui.td} text-muted`} colSpan={4}>
                      No overtime to show for {period}. Overtime is computed from recorded check-in and
                      check-out times — it fills in as people sign in/out in Slack (or when times are
                      added manually on the Attendance page).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-muted text-xs mt-3">
            Overtime = time present beyond the standard shift ({shiftHoursFor(from)}h from Oct 5, 2026;
            12h before). Only days with both a check-in and a check-out are counted.
          </p>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <Overtime />
    </Guard>
  );
}
