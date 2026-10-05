'use client';

import { Fragment, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
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
function overtimeOf(date: string, checkIn: string | null, checkOut: string | null): number {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, elapsedHours(checkIn, checkOut) - shiftHoursFor(date));
}
function fmtH(h: number): string {
  if (h <= 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

interface DayRow {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  worked: number | null;
  ot: number;
}
interface Row {
  employee: Employee;
  totalOt: number;
  totalWorked: number;
  daysWithTimes: number;
  days: DayRow[];
}

function Overtime() {
  const { can } = useAuth();
  const canEdit = can('attendance:update');
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
      if (recs.length === 0) continue;
      let totalOt = 0;
      let totalWorked = 0;
      let daysWithTimes = 0;
      const days: DayRow[] = recs
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => {
          const worked = r.checkIn && r.checkOut ? elapsedHours(r.checkIn, r.checkOut) : null;
          const ot = overtimeOf(r.date, r.checkIn, r.checkOut);
          if (worked != null) {
            totalWorked += worked;
            totalOt += ot;
            daysWithTimes += 1;
          }
          return { date: r.date, status: r.status, checkIn: r.checkIn, checkOut: r.checkOut, worked, ot };
        });
      // Keep the view overtime-focused: only people with at least one timed day.
      if (daysWithTimes === 0) continue;
      out.push({ employee: e, totalOt, totalWorked, daysWithTimes, days });
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
                      className="cursor-pointer hover:bg-panel2/50"
                      onClick={() => setOpen(open === r.employee.id ? null : r.employee.id)}
                    >
                      <td className={`${ui.td} whitespace-nowrap`}>
                        <span className="text-muted mr-1">{open === r.employee.id ? '▾' : '▸'}</span>
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
                    {open === r.employee.id && (
                      <tr>
                        <td className="bg-panel2/30 px-4 py-3 border-b border-line" colSpan={4}>
                          <div className="text-muted text-xs mb-2">
                            Each logged day — overtime is time beyond the shift (9h from Oct 5, 2026; 12h before).
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted">
                                <th className="text-left font-medium py-1">Date</th>
                                <th className="text-left font-medium py-1">Sign in</th>
                                <th className="text-left font-medium py-1">Sign out</th>
                                <th className="text-left font-medium py-1">Worked</th>
                                <th className="text-left font-medium py-1">Overtime</th>
                                {canEdit && <th className="text-left font-medium py-1">Edit</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {r.days.map((d) => (
                                <DayLine
                                  key={d.date}
                                  employeeId={r.employee.id}
                                  day={d}
                                  canEdit={canEdit}
                                  onSaved={() => attendance.reload()}
                                />
                              ))}
                            </tbody>
                          </table>
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
                      added manually here or on the Attendance page).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-muted text-xs mt-3">
            Overtime = time present beyond the standard shift (9h from Oct 5, 2026; 12h before). Only days
            with both a sign-in and a sign-out count toward worked hours and overtime.
          </p>
        </>
      )}
    </>
  );
}

// One day in the per-employee breakdown, with inline editing of the times.
function DayLine({
  employeeId,
  day,
  canEdit,
  onSaved,
}: {
  employeeId: string;
  day: DayRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ci, setCi] = useState(day.checkIn ?? '');
  const [co, setCo] = useState(day.checkOut ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          employeeId,
          date: day.date,
          status: day.status || 'present',
          checkIn: ci.trim() || null,
          checkOut: co.trim() || null,
        }),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-line/60">
        <td className="py-1.5">{day.date}</td>
        <td className="py-1.5" colSpan={canEdit ? 5 : 4}>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              className={`${ui.input} !w-24 !py-1`}
              placeholder="HH:MM"
              value={ci}
              onChange={(e) => setCi(e.target.value)}
            />
            <span className="text-muted">→</span>
            <input
              className={`${ui.input} !w-24 !py-1`}
              placeholder="HH:MM"
              value={co}
              onChange={(e) => setCo(e.target.value)}
            />
            <button className={`${ui.btn} !py-1 !px-3`} onClick={save} disabled={busy}>
              {busy ? '…' : 'Save'}
            </button>
            <button
              className={`${ui.btnGhost} !py-1 !px-3`}
              onClick={() => { setEditing(false); setCi(day.checkIn ?? ''); setCo(day.checkOut ?? ''); }}
            >
              Cancel
            </button>
            <span className="text-muted">(24h, e.g. 11:00 and 20:30)</span>
            {err && <span className="text-danger">{err}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line/60">
      <td className="py-1.5">{day.date}</td>
      <td className="py-1.5">{day.checkIn ?? '—'}</td>
      <td className="py-1.5">{day.checkOut ?? '—'}</td>
      <td className="py-1.5">{day.worked != null ? fmtH(day.worked) : '—'}</td>
      <td className={`py-1.5 ${day.ot > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}`}>
        {day.ot > 0 ? `+${fmtH(day.ot)}` : '—'}
      </td>
      {canEdit && (
        <td className="py-1.5">
          <button className={`${ui.btnGhost} !py-1 !px-3`} onClick={() => setEditing(true)}>Edit</button>
        </td>
      )}
    </tr>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <Overtime />
    </Guard>
  );
}
