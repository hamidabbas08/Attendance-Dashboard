'use client';

import { CSSProperties, FormEvent, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: string;
}
interface Record {
  id: string;
  employeeId: string;
  date: string;
  status: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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

function cellFor(date: string, rec: Record | undefined): { t: string; cls: string } {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (rec) {
    switch (rec.status) {
      case 'present':
      case 'late':
        return { t: 'P', cls: 'bg-emerald-600/25 text-emerald-300' };
      case 'absent':
        return { t: 'A', cls: 'bg-red-600 text-white' };
      case 'leave':
        return { t: 'L', cls: 'bg-blue-700/40 text-blue-200' };
      case 'half_day':
        return { t: '½', cls: 'bg-amber-700/40 text-amber-200' };
      case 'holiday':
        return { t: 'H', cls: 'bg-blue-900/50 text-blue-300' };
      case 'off_day':
        return { t: 'Off', cls: 'text-muted' };
    }
  }
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

  const emps = employees.data ?? [];
  const stickyTh = (left: number, width: number): CSSProperties => ({
    position: 'sticky',
    left,
    minWidth: width,
    width,
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h2 className={ui.h2}>Attendance</h2>
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
              <option value="all">Full year (to date)</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {can('attendance:update') && <MarkForm employees={emps} onSaved={() => attendance.reload()} />}

      <div className={`${ui.card} overflow-x-auto p-0`}>
        <table className="border-collapse text-xs" style={{ minWidth: SUMMARY_WIDTH + days.length * W.day }}>
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
                    style={{ minWidth: W.day, width: W.day }}
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
                if (rec?.status === 'present' || rec?.status === 'late') present += 1;
                if (rec?.status === 'absent') absent += 1;
                return { d, ...cellFor(d, rec) };
              });
              const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
              const rowBg = idx % 2 ? 'bg-panel' : 'bg-panel2/40';
              const stickyBg = idx % 2 ? 'bg-panel' : 'bg-[#20293c]';
              return (
                <tr key={e.id} className={rowBg}>
                  <td className={`px-3 py-1.5 border-b border-line whitespace-nowrap ${stickyBg}`} style={stickyTh(LEFT.name, W.name)}>
                    {e.name}
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
                        title={`${e.name} · ${c.d}${c.t ? ` · ${c.t}` : ''}`}
                        className={`text-center border-b border-line ${first ? 'border-l-2 border-l-line' : 'border-l border-line'} ${c.cls}`}
                        style={{ minWidth: W.day, width: W.day, height: 26 }}
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
                  No employees yet. Go to <b>Team</b> and click <b>Sync from Slack</b> to import your
                  workspace members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted text-xs mt-2">
        Legend: <b className="text-emerald-300">P</b> present (late counts as present) ·{' '}
        <b className="text-red-400">A</b> absent · <b>Off</b> off day / Sunday · <b>L</b> leave ·{' '}
        <b>½</b> half day · blank = not recorded.
      </p>
    </>
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
