'use client';

import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { to12h, ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  avatarUrl?: string | null;
  createdAt: string;
}
const isActive = (e: Employee) => e.status === 'active';
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
const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// Saturdays are standard days off for everyone from this date onward (HR policy,
// Oct 2026). 2026-10-03 is the first such Saturday.
const SATURDAY_OFF_FROM = '2026-10-03';

// Fixed widths so the frozen summary columns can be pinned precisely.
const W = { name: 190, present: 74, absent: 74, pct: 60, day: 30 };
const LEFT = {
  name: 0,
  present: W.name,
  absent: W.name + W.present,
  pct: W.name + W.present + W.absent,
};
const SUMMARY_WIDTH = W.name + W.present + W.absent + W.pct;

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}
/** Logged hours between sign-in and sign-out (checkout ≤ checkin = overnight). */
function loggedHours(checkIn: string, checkOut: string): number {
  const a = parseHM(checkIn);
  let b = parseHM(checkOut);
  if (b <= a) b += 24;
  return b - a;
}
function fmtDur(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}
/** Hover text for a cell: name, date, status, and logged hours from Slack. */
function cellTitle(name: string, date: string, t: string, rec: Record | undefined, holidayName?: string): string {
  let line = `${name} · ${date}${t ? ` · ${t}` : ''}`;
  if (rec?.checkIn && rec?.checkOut) {
    line += `\nSign in ${to12h(rec.checkIn)} → Sign out ${to12h(rec.checkOut)} · Logged ${fmtDur(loggedHours(rec.checkIn, rec.checkOut))}`;
  } else if (rec?.checkIn) {
    line += `\nSign in ${to12h(rec.checkIn)} · no sign-out yet`;
  } else if (rec?.checkOut) {
    line += `\nSign out ${to12h(rec.checkOut)}`;
  }
  if (holidayName) line += `\nHoliday: ${holidayName}`;
  return line;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function cellFor(date: string, rec: Record | undefined, holidayName?: string): { t: string; cls: string } {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Worked attendance always shows, even on a holiday or weekend — so anyone who
  // actually logged time on a declared holiday still gets their P.
  if (rec && (rec.status === 'present' || rec.status === 'late')) {
    return { t: 'P', cls: 'bg-emerald-600/25 text-emerald-300' };
  }
  // Otherwise a declared company holiday marks the whole day off for everyone —
  // shown the same way as a Sunday off (the holiday name is in the tooltip).
  if (holidayName) return { t: 'Off', cls: 'text-muted/70' };
  if (rec) {
    switch (rec.status) {
      case 'absent':
        return { t: 'A', cls: 'bg-red-600 text-white' };
      case 'leave':
        return { t: 'L', cls: 'bg-blue-700/40 text-blue-200' };
      case 'half_day':
        return { t: '½', cls: 'bg-amber-700/40 text-amber-200' };
      case 'holiday':
        return { t: 'Off', cls: 'text-muted/70' };
      case 'off_day':
        return { t: 'Off', cls: 'text-muted' };
    }
  }
  // Saturdays are standard company days off from 2026-10-03 onward (HR policy).
  // Anyone who still works an as-needed Saturday keeps their P from the record
  // block above; everyone else shows Off (past and future alike).
  if (wd === 6 && date >= SATURDAY_OFF_FROM) return { t: 'Off', cls: 'text-muted/70' };
  if (date > today()) return { t: '', cls: '' };
  if (wd === 0) return { t: 'Off', cls: 'text-muted/70' }; // Sunday
  return { t: '', cls: '' };
}

function Attendance() {
  const { can } = useAuth();
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());

  const isCurYear = year === curYear;
  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  const rawTo =
    month === 'all'
      ? `${year}-12-31`
      : `${year}-${pad(month + 1)}-${pad(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`;
  // "Till today" for the current year so we don't show a wall of empty future days.
  const to = isCurYear && rawTo > today() ? today() : rawTo;

  const employees = useFetch<Employee[]>('/api/employees');
  const attendance = useFetch<Record[]>(`/api/attendance?from=${from}&to=${to}`);
  const holidays = useFetch<{ id: string; date: string; name: string }[]>('/api/holidays');
  const holidayByDate = useMemo(
    () => new Map((holidays.data ?? []).map((h) => [h.date, h.name])),
    [holidays.data],
  );

  const days = useMemo(() => daysInRange(from, to), [from, to]);
  const monthGroups = useMemo(() => {
    const g: { label: string; count: number }[] = [];
    for (const d of days) {
      const label = MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3);
      const last = g[g.length - 1];
      if (last && last.label === label) last.count += 1;
      else g.push({ label, count: 1 });
    }
    return g;
  }, [days]);
  const recIndex = useMemo(() => {
    const m = new Map<string, Record>();
    for (const r of attendance.data ?? []) m.set(`${r.employeeId}|${r.date}`, r);
    return m;
  }, [attendance.data]);

  const withRecords = useMemo(() => {
    const s = new Set<string>();
    for (const r of attendance.data ?? []) s.add(r.employeeId);
    return s;
  }, [attendance.data]);
  // Show active people, plus former members only for months they have records in.
  const emps = (employees.data ?? []).filter((e) => isActive(e) || withRecords.has(e.id));
  // A single month is narrow enough to stretch across the whole card; the full
  // year keeps fixed-width day columns and scrolls horizontally.
  const stretch = month !== 'all';
  const stickyTh = (left: number, width: number): CSSProperties => ({
    position: 'sticky',
    left,
    minWidth: width,
    width,
  });
  const dayCell: CSSProperties = stretch ? { minWidth: W.day } : { minWidth: W.day, width: W.day };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h2 className={ui.h2}>Attendance</h2>
        <div className="flex items-end gap-3">
          {can('employees:create') && <PullButton onDone={() => attendance.reload()} />}
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
              <option value="all">Full year (to date)</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {can('attendance:update') && <MarkForm employees={emps} onSaved={() => attendance.reload()} />}

      {can('attendance_rules:create') && (
        <HolidayManager holidays={holidays.data ?? []} onChange={() => holidays.reload()} />
      )}

      {emps.length > 0 && (attendance.data?.length ?? 0) === 0 && !attendance.loading && (
        <div className="surface p-4 mb-5 text-sm text-amber-300/90">
          No attendance recorded for {month === 'all' ? year : `${MONTHS[month]} ${year}`}. Try another
          month or <b>Full year (to date)</b> — imported history may be in earlier months.
        </div>
      )}

      <div className={`${ui.card} overflow-x-auto p-0`}>
        <table
          className="border-collapse text-xs"
          style={stretch ? { width: '100%' } : { minWidth: SUMMARY_WIDTH + days.length * W.day }}
        >
          <thead>
            <tr className="bg-panel">
              <th rowSpan={2} className="text-left px-3 border-b border-line bg-panel" style={stickyTh(LEFT.name, W.name)}>
                Employee
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel" style={stickyTh(LEFT.present, W.present)}>
                Present
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel" style={stickyTh(LEFT.absent, W.absent)}>
                Absent
              </th>
              <th rowSpan={2} className="text-muted border-b border-line bg-panel border-r-2 border-r-line" style={stickyTh(LEFT.pct, W.pct)}>
                %
              </th>
              {monthGroups.map((g, i) => (
                <th key={i} colSpan={g.count} className="text-muted font-semibold border-b border-l border-line py-1">
                  {g.label}
                </th>
              ))}
            </tr>
            <tr className="bg-panel">
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00Z`);
                const first = d.slice(8, 10) === '01';
                const sun = dt.getUTCDay() === 0;
                return (
                  <th
                    key={d}
                    className={`font-normal border-b border-line py-1 ${first ? 'border-l-2 border-l-line' : 'border-l border-line'} ${sun ? 'text-accent' : 'text-muted'}`}
                    style={dayCell}
                  >
                    <div>{pad(dt.getUTCDate())}</div>
                    <div className="text-[10px]">{WD[dt.getUTCDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {emps.map((e, idx) => {
              let present = 0;
              let absent = 0;
              const cells = days.map((d) => {
                const rec = recIndex.get(`${e.id}|${d}`);
                const hol = holidayByDate.get(d);
                // Worked time counts as present even on a holiday; absences on a
                // holiday don't count (it's a day off).
                if (rec?.status === 'present' || rec?.status === 'late') present += 1;
                if (!hol && rec?.status === 'absent') absent += 1;
                const cell = cellFor(d, rec, hol);
                return { d, ...cell, title: cellTitle(e.name, d, cell.t, rec, hol) };
              });
              const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
              const rowBg = idx % 2 ? 'bg-panel' : 'bg-panel2/40';
              const stickyBg = idx % 2 ? 'bg-panel' : 'bg-[#20293c]';
              return (
                <tr key={e.id} className={rowBg}>
                  <td className={`px-3 py-1.5 border-b border-line whitespace-nowrap ${stickyBg}`} style={stickyTh(LEFT.name, W.name)}>
                    <div className="flex items-center gap-2">
                      <Avatar src={e.avatarUrl} name={e.name} size={22} />
                      <span className="truncate">{e.name}</span>
                    </div>
                  </td>
                  <td className={`text-center py-1.5 border-b border-line font-semibold text-emerald-300 ${stickyBg}`} style={stickyTh(LEFT.present, W.present)}>
                    {present}
                  </td>
                  <td className={`text-center py-1.5 border-b border-line font-semibold text-danger ${stickyBg}`} style={stickyTh(LEFT.absent, W.absent)}>
                    {absent}
                  </td>
                  <td className={`text-center py-1.5 border-b border-line border-r-2 border-r-line ${stickyBg}`} style={stickyTh(LEFT.pct, W.pct)}>
                    {pct}%
                  </td>
                  {cells.map((c) => {
                    const first = c.d.slice(8, 10) === '01';
                    return (
                      <td
                        key={c.d}
                        title={c.title}
                        className={`text-center border-b border-line ${first ? 'border-l-2 border-l-line' : 'border-l border-line'} ${c.cls}`}
                        style={{ ...dayCell, height: 26 }}
                      >
                        {c.t}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {emps.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-muted" colSpan={4 + days.length}>
                  No employees yet — workspace members sync from Slack automatically after login.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted text-xs mt-2">
        Legend: <b className="text-emerald-300">P</b> present (late counts as present) ·{' '}
        <b className="text-red-400">A</b> absent · <b>Off</b> off day / Sunday &amp; Saturday (from Oct 3, 2026) / holiday ·{' '}
        <b>L</b> leave · <b>½</b> half day · blank = not recorded.
      </p>
    </>
  );
}

// Pulls the latest #attendance check-ins from Slack on demand (bot-token poll),
// then reloads the grid. Complements the automatic 60s background poller.
function PullButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function pull() {
    setBusy(true);
    setMsg('');
    try {
      const r = await api<{ recorded: number; scanned: number }>('/api/slack/poll', { method: 'POST' });
      setMsg(`Recorded ${r.recorded} of ${r.scanned} message${r.scanned === 1 ? '' : 's'}.`);
      onDone();
    } catch (err) {
      setMsg((err as ApiError).message);
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 6000);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button type="button" className={ui.btnGhost} onClick={pull} disabled={busy}>
        {busy ? 'Pulling…' : 'Pull check-ins'}
      </button>
      {msg && <span className="text-[11px] text-muted whitespace-nowrap">{msg}</span>}
    </div>
  );
}

interface Holiday {
  id: string;
  date: string;
  name: string;
}

// Declare company holidays: a whole day off for everyone, with a name.
function HolidayManager({ holidays, onChange }: { holidays: Holiday[]; onChange: () => void }) {
  const [date, setDate] = useState(today());
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api('/api/holidays', { method: 'POST', body: JSON.stringify({ date, name: name.trim() }) });
      setName('');
      onChange();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className={ui.card}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Company holidays</h3>
        <span className="text-muted text-xs">Marks the whole day off for everyone</span>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={add}>
        <div>
          <label className={ui.label}>Date</label>
          <input className={ui.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="min-w-[220px] flex-1">
          <label className={ui.label}>Holiday name</label>
          <input
            className={ui.input}
            placeholder="e.g. Eid ul-Fitr, Independence Day"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <button className={ui.btn} disabled={busy}>{busy ? 'Saving…' : 'Mark holiday'}</button>
        {error && <div className={ui.error}>{error}</div>}
      </form>

      {sorted.length > 0 && (
        <div className="mt-4 border-t border-line/60 pt-3">
          <div className="text-muted text-xs mb-2">Declared holidays</div>
          <div className="flex flex-col divide-y divide-line/50">
            {sorted.map((h) => (
              <HolidayRow key={h.id} holiday={h} onChange={onChange} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// A single declared holiday — editable (date + name). Holidays aren't removed.
function HolidayRow({ holiday, onChange }: { holiday: Holiday; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(holiday.date);
  const [name, setName] = useState(holiday.name);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setErr('');
    try {
      await api('/api/holidays', { method: 'POST', body: JSON.stringify({ date, name: name.trim() }) });
      // If the date moved, drop the old-date entry so there's just one.
      if (date !== holiday.date) {
        await api(`/api/holidays/${holiday.id}`, { method: 'DELETE' });
      }
      setEditing(false);
      onChange();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 flex-wrap">
        <input className={`${ui.input} !w-40`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input className={`${ui.input} !w-56`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" />
        <button className={`${ui.btn} !py-1.5 !px-3`} onClick={save} disabled={busy}>{busy ? '…' : 'Save'}</button>
        <button className={`${ui.btnGhost} !py-1.5 !px-3`} onClick={() => { setEditing(false); setDate(holiday.date); setName(holiday.name); }}>Cancel</button>
        {err && <span className={ui.error}>{err}</span>}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between py-2">
      <div className="text-sm">
        <span className="font-semibold">{holiday.date}</span>
        <span className="text-muted"> · {holiday.name}</span>
      </div>
      <button type="button" className="text-xs text-accent hover:underline" onClick={() => setEditing(true)}>
        Edit
      </button>
    </div>
  );
}

function MarkForm({ employees, onSaved }: { employees: Employee[]; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('present');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/attendance', { method: 'PUT', body: JSON.stringify({ employeeId, date, status }) });
      onSaved();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <div className={ui.card}>
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <div className="min-w-[180px]">
          <label className={ui.label}>Employee</label>
          <select className={ui.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={ui.label}>Date</label>
          <input className={ui.input} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className={ui.label}>Status</label>
          <select className={ui.input} value={status} onChange={(e) => setStatus(e.target.value)}>
            {['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <button className={ui.btn}>Mark attendance</button>
        {error && <div className={ui.error}>{error}</div>}
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <Attendance />
    </Guard>
  );
}
