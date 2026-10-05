'use client';

import { Fragment, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Guard, StatTile, TableSkeleton, TilesSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  status: string;
  avatarUrl?: string | null;
}
interface Record {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}
interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
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

// Overtime is only applied from this date onward; earlier days show worked hours
// but never accrue overtime.
const OVERTIME_FROM = '2026-10-05';

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
  if (date < OVERTIME_FROM) return 0; // overtime only applies from the cutoff onward
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

/** Per-day worked/overtime for one person's records, plus totals. */
function computeDays(recs: Record[]) {
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
  return { days, totalOt, totalWorked, daysWithTimes };
}

/** Year + month selector shared by both views. */
function PeriodControls({
  year, setYear, month, setMonth, curYear,
}: {
  year: number; setYear: (y: number) => void;
  month: number | 'all'; setMonth: (m: number | 'all') => void; curYear: number;
}) {
  return (
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
  );
}

function rangeFor(year: number, month: number | 'all') {
  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  const to =
    month === 'all'
      ? `${year}-12-31`
      : `${year}-${pad(month + 1)}-${pad(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`;
  return { from, to };
}

function ShiftBanner({ shift }: { shift: Shift | null }) {
  return (
    <div className="surface p-4 mb-5 flex items-center gap-3 flex-wrap">
      <span className="text-muted text-sm">Your shift:</span>
      {shift ? (
        <span className="font-semibold">
          {shift.startTime} – {shift.endTime}
          <span className="text-muted font-normal"> · {shift.graceMins}m grace{shift.name ? ` · ${shift.name}` : ''}</span>
        </span>
      ) : (
        <span className="text-muted">Not set yet — your HR/owner can assign a shift on the Shifts page.</span>
      )}
    </div>
  );
}

function fmtDur(h: number) {
  return fmtH(h);
}

// ------------------------------------------------------------------ Personal

function PersonalOvertime() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());

  const meInfo = useFetch<{ employee: Employee | null; shift: Shift | null }>('/api/employees/me');
  const attendance = useFetch<Record[]>('/api/attendance/me');

  const { from, to } = rangeFor(year, month);
  const { days, totalOt, totalWorked, daysWithTimes } = useMemo(() => {
    const recs = (attendance.data ?? []).filter((r) => r.date >= from && r.date <= to);
    return computeDays(recs);
  }, [attendance.data, from, to]);

  const loading = attendance.loading && !attendance.data;
  const period = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className={ui.h2}>My Overtime</h2>
          <p className={ui.subtitle}>Your hours beyond the standard shift</p>
        </div>
        <PeriodControls year={year} setYear={setYear} month={month} setMonth={setMonth} curYear={curYear} />
      </div>

      <ShiftBanner shift={meInfo.data?.shift ?? null} />

      {loading ? (
        <>
          <div className={`${ui.grid} mb-5`}><TilesSkeleton count={3} /></div>
          <TableSkeleton rows={6} cols={5} />
        </>
      ) : (
        <>
          <div className={`${ui.grid} mb-5`}>
            <StatTile label={`My overtime · ${period}`} value={fmtH(totalOt)} accent="#f59e0b" />
            <StatTile label="Days logged" value={daysWithTimes} accent="#38bdf8" />
            <StatTile label="Total worked" value={fmtH(totalWorked)} accent="#a78bfa" />
          </div>

          <div className="surface p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted">
                  <th className="text-left font-medium py-2">Date</th>
                  <th className="text-left font-medium py-2">Sign in</th>
                  <th className="text-left font-medium py-2">Sign out</th>
                  <th className="text-left font-medium py-2">Worked</th>
                  <th className="text-left font-medium py-2">Overtime</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date} className="border-t border-line/60">
                    <td className="py-1.5">{d.date}</td>
                    <td className="py-1.5">{d.checkIn ?? '—'}</td>
                    <td className="py-1.5">{d.checkOut ?? '—'}</td>
                    <td className="py-1.5">{d.worked != null ? fmtDur(d.worked) : '—'}</td>
                    <td className={`py-1.5 ${d.ot > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}`}>
                      {d.ot > 0 ? `+${fmtDur(d.ot)}` : '—'}
                    </td>
                  </tr>
                ))}
                {days.length === 0 && (
                  <tr>
                    <td className="py-3 text-muted" colSpan={5}>
                      No attendance recorded for {period}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-muted text-xs mt-3">
            Overtime applies from Oct 5, 2026 onward — time present beyond the 9h shift. Earlier days show
            worked hours but no overtime. Only days with both a sign-in and a sign-out are counted.
          </p>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------- Team

function TeamOvertime() {
  const { can } = useAuth();
  const canEdit = can('attendance:update');
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());
  const [open, setOpen] = useState<string | null>(null);

  const { from, to } = rangeFor(year, month);

  const employees = useFetch<Employee[]>('/api/employees');
  const attendance = useFetch<Record[]>(`/api/attendance?from=${from}&to=${to}`);

  const rows = useMemo(() => {
    const byEmp = new Map<string, Record[]>();
    for (const r of attendance.data ?? []) {
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
      byEmp.get(r.employeeId)!.push(r);
    }
    const out: { employee: Employee; totalOt: number; totalWorked: number; daysWithTimes: number; days: DayRow[] }[] = [];
    for (const e of employees.data ?? []) {
      const recs = byEmp.get(e.id) ?? [];
      if (recs.length === 0) continue;
      const c = computeDays(recs);
      if (c.daysWithTimes === 0) continue;
      out.push({ employee: e, ...c });
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
        <PeriodControls year={year} setYear={setYear} month={month} setMonth={setMonth} curYear={curYear} />
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
                        <div className="flex items-center gap-2">
                          <span className="text-muted">{open === r.employee.id ? '▾' : '▸'}</span>
                          <Avatar src={r.employee.avatarUrl} name={r.employee.name} size={26} />
                          <span>{r.employee.name}</span>
                        </div>
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
                            Each logged day — overtime applies from Oct 5, 2026 (time beyond the 9h shift).
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
            Overtime applies from Oct 5, 2026 onward — time present beyond the 9h shift. Earlier days show
            worked hours but no overtime. Only days with both a sign-in and a sign-out are counted.
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

function Switcher() {
  const { can } = useAuth();
  return can('attendance:view_all') ? <TeamOvertime /> : <PersonalOvertime />;
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <Switcher />
    </Guard>
  );
}
