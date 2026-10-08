'use client';

import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Guard, PageHeader } from '../../lib/components';
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
// Today's date in PKT (company timezone, UTC+5), for spotting still-open shifts.
function pktToday(): string {
  return pktNow().date;
}
// Current PKT date and minutes-since-midnight, for precise overnight checks.
function pktNow(): { date: string; minutes: number } {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
/**
 * The real sign-out for a record, or null if the person hasn't signed out yet.
 * A sign-out earlier than the sign-in is an overnight shift whose end falls on
 * the NEXT day at that time, so it only counts once that exact moment has passed
 * in PKT. Until then the value is a not-yet-real / mis-paired sign-out and the
 * shift is still open (e.g. an Oct 6 shift ending ~2 AM Oct 7 shows no sign-out
 * until 2 AM Oct 7 arrives).
 */
function effectiveCheckOut(date: string, checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return checkOut;
  const overnight = parseHM(checkOut) <= parseHM(checkIn);
  if (!overnight) return checkOut;
  const endDate = nextDate(date);
  const now = pktNow();
  if (endDate > now.date) return null;
  if (endDate === now.date && parseHM(checkOut) * 60 > now.minutes) return null;
  return checkOut;
}
/**
 * True when a record is a still-open shift today: the person has signed in but
 * not signed out yet. Attendance is only marked present after sign-out, so such
 * a day is shown as pending (not P) and doesn't count toward present. Past days
 * (shift already over) and manually-marked days (no sign-in at all) are never
 * pending — they count as present as before.
 */
function pendingSignOut(date: string, rec: Record | undefined): boolean {
  if (!rec || !rec.checkIn) return false;
  if (date < pktToday()) return false;
  return !effectiveCheckOut(date, rec.checkIn, rec.checkOut);
}
/** Hover text for a cell: name, date, status, and logged hours from Slack. */
function cellTitle(name: string, date: string, t: string, rec: Record | undefined, holidayName?: string): string {
  let line = `${name} · ${date}${t ? ` · ${t}` : ''}`;
  const checkOut = rec ? effectiveCheckOut(date, rec.checkIn, rec.checkOut) : null;
  if (rec?.checkIn && checkOut) {
    line += `\nSign in ${to12h(rec.checkIn)} → Sign out ${to12h(checkOut)} · Logged ${fmtDur(loggedHours(rec.checkIn, checkOut))}`;
  } else if (rec?.checkIn) {
    line += `\nSign in ${to12h(rec.checkIn)} · no sign-out yet`;
  } else if (checkOut) {
    line += `\nSign out ${to12h(checkOut)}`;
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
  // Attendance history (P/A/leave/half-day) only exists from the employee's
  // joining day onward — but Off/holiday are calendar facts that apply to
  // everyone regardless of when they joined, so those still show below even
  // for a not-yet-joined row (a record can never predate joinDate, since
  // joinDate is derived as the earlier of the two — see the caller).
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Worked attendance always shows, even on a holiday or weekend — so anyone who
  // actually logged time on a declared holiday still gets their P. But present is
  // only marked after sign-out: a still-open shift today (signed in, no sign-out
  // yet) shows as pending, not P.
  if (rec && (rec.status === 'present' || rec.status === 'late')) {
    if (pendingSignOut(date, rec)) return { t: '•', cls: 'text-amber-300/70' };
    return { t: 'P', cls: 'bg-emerald-600/25 text-emerald-300' };
  }
  // Otherwise a declared company holiday marks the whole day off for everyone.
  // Show the holiday's own name (e.g. "Eid") rather than a generic "Off", so
  // named holidays are distinguishable in the grid — truncated to fit the
  // narrow day column; the full name is still in the hover tooltip.
  if (holidayName) {
    const label = holidayName.length > 3 ? holidayName.slice(0, 3) : holidayName;
    return { t: label, cls: 'text-muted/70' };
  }
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
  // Earliest attendance date we've seen per employee, so an employee who has
  // history from before their stored join date still shows all of it.
  const earliestRecord = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of attendance.data ?? []) {
      const cur = m.get(r.employeeId);
      if (!cur || r.date < cur) m.set(r.employeeId, r.date);
    }
    return m;
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
    // `position: sticky` cells inside a `border-collapse` table are prone to a
    // Chromium rendering bug where a scrolled-past day column bleeds through
    // to the left of the sticky column during/after a horizontal scroll —
    // `isolation: isolate` gives the cell its own stacking/paint context so
    // nothing from outside it can show through.
    isolation: 'isolate',
    zIndex: 1,
  });
  const dayCell: CSSProperties = stretch ? { minWidth: W.day } : { minWidth: W.day, width: W.day };

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Company-wide daily attendance, holidays and manual adjustments."
        actions={
          <>
            {can('employees:create') && <PullButton onDone={() => attendance.reload()} />}
            <HolidaysDropdown holidays={holidays.data ?? []} year={year} month={month} />
            <div>
              <label className={ui.label}>Year</label>
              <select className={`${ui.input} !w-auto min-w-[88px] font-medium`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[curYear - 1, curYear, curYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={ui.label}>Month</label>
              <select
                className={`${ui.input} !w-auto min-w-[150px] font-medium`}
                value={month}
                onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              >
                <option value="all">Full year (to date)</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
          </>
        }
      />

      {can('attendance:update') && (
        <MarkForm
          employees={emps}
          canDeclareHoliday={can('attendance_rules:create')}
          onSaved={() => {
            attendance.reload();
            holidays.reload();
          }}
        />
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
              // Attendance starts from the day the employee joined. Use the
              // earliest of their stored join date and any record we have for
              // them, so no history is ever hidden.
              const createdDate = (e.createdAt || '').slice(0, 10);
              const firstRec = earliestRecord.get(e.id);
              const joinDate = [createdDate, firstRec].filter(Boolean).sort()[0] || undefined;
              const cells = days.map((d) => {
                const beforeJoin = joinDate ? d < joinDate : false;
                const rec = recIndex.get(`${e.id}|${d}`);
                const hol = holidayByDate.get(d);
                // Worked time counts as present even on a holiday; absences on a
                // holiday don't count (it's a day off). A still-open shift today
                // (no sign-out yet) is pending — not counted present until sign-out.
                // Days before joining are ignored entirely.
                if (!beforeJoin) {
                  if ((rec?.status === 'present' || rec?.status === 'late') && !pendingSignOut(d, rec)) present += 1;
                  if (!hol && rec?.status === 'absent') absent += 1;
                }
                const cell = cellFor(d, rec, hol);
                return { d, ...cell, title: cellTitle(e.name, d, cell.t, rec, hol) };
              });
              const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
              const rowBg = idx % 2 ? 'bg-panel' : 'bg-panel2/40';
              const stickyBg = idx % 2 ? 'bg-panel' : 'bg-[#16243a]';
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
        <b className="text-red-400">A</b> absent · <b className="text-amber-300/70">•</b> signed in, awaiting sign-out ·{' '}
        <b>Off</b> off day / Sunday &amp; Saturday (from Oct 3, 2026) / holiday ·{' '}
        <b>L</b> leave · <b>½</b> half day · blank = not recorded.
      </p>
    </>
  );
}

// Read-only list of declared holidays, scoped to whatever year/month the grid
// is currently showing — a dropdown instead of a dedicated card, since the
// grid itself already shows each holiday's name on its day now. Creating a
// holiday still happens through the Mark Attendance form above.
function HolidaysDropdown({
  holidays, year, month,
}: {
  holidays: { date: string; name: string }[]; year: number; month: number | 'all';
}) {
  const [open, setOpen] = useState(false);
  const prefix = month === 'all' ? `${year}-` : `${year}-${pad(month + 1)}-`;
  const periodLabel = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;
  const sorted = [...holidays]
    .filter((h) => h.date.startsWith(prefix))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="relative">
      <label className={ui.label}>&nbsp;</label>
      <button
        type="button"
        className={`${ui.btnGhost} !py-2.5 whitespace-nowrap`}
        onClick={() => setOpen((o) => !o)}
      >
        Holidays · {sorted.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 w-72 max-h-80 overflow-y-auto surface p-3 shadow-xl">
            <div className="text-muted text-xs mb-2">Declared holidays · {periodLabel}</div>
            {sorted.length > 0 ? (
              <div className="flex flex-col divide-y divide-line/50">
                {sorted.map((h) => {
                  const wd = WD[new Date(`${h.date}T00:00:00Z`).getUTCDay()];
                  return (
                    <div key={h.date} className="py-2 text-sm flex items-center justify-between gap-3">
                      <span className="font-semibold whitespace-nowrap">
                        {h.date} <span className="text-muted font-normal">({wd})</span>
                      </span>
                      <span className="text-muted truncate">{h.name}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted text-sm">No holidays declared in {periodLabel}.</div>
            )}
          </div>
        </>
      )}
    </div>
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

// Sentinel status value: selecting it in the Status dropdown switches the form
// into "declare a company holiday" mode (see MarkForm below) instead of
// recording one employee's attendance.
const COMPANY_HOLIDAY = '__company_holiday__';

function MarkForm({
  employees, canDeclareHoliday, onSaved,
}: {
  employees: Employee[]; canDeclareHoliday: boolean; onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState('present');
  const [holidayName, setHolidayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isHoliday = status === COMPANY_HOLIDAY;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isHoliday) {
        if (!holidayName.trim()) return;
        await api('/api/holidays', { method: 'POST', body: JSON.stringify({ date, name: holidayName.trim() }) });
        setHolidayName('');
      } else {
        await api('/api/attendance', { method: 'PUT', body: JSON.stringify({ employeeId, date, status }) });
      }
      onSaved();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={ui.card}>
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        {isHoliday ? (
          // Holiday mode: no specific employee — it's the whole company, so the
          // Employee picker is replaced by the holiday's name.
          <div className="min-w-[220px] flex-1">
            <label className={ui.label}>Holiday name</label>
            <input
              className={ui.input}
              placeholder="e.g. Eid ul-Fitr, Independence Day"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              required
            />
          </div>
        ) : (
          <div className="min-w-[180px]">
            <label className={ui.label}>Employee</label>
            <select className={ui.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select…</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
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
            {canDeclareHoliday && <option value={COMPANY_HOLIDAY}>Company holiday (everyone)</option>}
          </select>
        </div>
        <button className={ui.btn} disabled={busy}>
          {busy ? 'Saving…' : isHoliday ? 'Mark holiday' : 'Mark attendance'}
        </button>
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
