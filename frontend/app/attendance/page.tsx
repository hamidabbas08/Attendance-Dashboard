'use client';

import { FormEvent, useMemo, useState } from 'react';
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

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
/** All 'YYYY-MM-DD' days in the given range (inclusive), UTC. */
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

// One grid cell: the letter to show and a color class, per the legend.
function cellFor(date: string, rec: Record | undefined, joined: string): { t: string; cls: string } {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (date < joined) return { t: '–', cls: 'text-muted/50' };
  if (rec) {
    switch (rec.status) {
      case 'present':
      case 'late':
        return { t: 'P', cls: 'bg-emerald-900/60 text-emerald-300' };
      case 'absent':
        return { t: 'A', cls: 'bg-red-800 text-white' };
      case 'leave':
        return { t: 'L', cls: 'bg-blue-900 text-blue-200' };
      case 'half_day':
        return { t: '½', cls: 'bg-amber-800 text-amber-200' };
      case 'holiday':
        return { t: 'H', cls: 'bg-blue-950 text-blue-300' };
      case 'off_day':
        return { t: 'Off', cls: 'bg-panel2 text-muted' };
    }
  }
  if (date > today()) return { t: '', cls: '' };
  if (wd === 0) return { t: 'Off', cls: 'bg-panel2 text-muted' }; // Sunday
  return { t: '', cls: '' }; // working day, not yet recorded
}

function Attendance() {
  const { can } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());

  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  const to =
    month === 'all'
      ? `${year}-12-31`
      : `${year}-${pad(month + 1)}-${pad(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`;

  const employees = useFetch<Employee[]>('/api/employees');
  const attendance = useFetch<Record[]>(`/api/attendance?from=${from}&to=${to}`);

  const days = useMemo(() => daysInRange(from, to), [from, to]);
  const recIndex = useMemo(() => {
    const m = new Map<string, Record>();
    for (const r of attendance.data ?? []) m.set(`${r.employeeId}|${r.date}`, r);
    return m;
  }, [attendance.data]);

  const emps = employees.data ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <h2 className={ui.h2}>Attendance</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className={ui.label}>Year</label>
            <select className={ui.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[year - 1, year, year + 1].map((y) => (
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

      {can('attendance:update') && <MarkForm employees={emps} onSaved={() => attendance.reload()} />}

      <div className={`${ui.card} overflow-x-auto p-0`}>
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-panel px-3 py-2 text-left border-b border-line min-w-[180px]">
                Employee
              </th>
              <th className="px-2 py-2 border-b border-line text-muted">Present</th>
              <th className="px-2 py-2 border-b border-line text-muted">Absent</th>
              <th className="px-2 py-2 border-b border-line text-muted">%</th>
              {days.map((d) => {
                const dt = new Date(`${d}T00:00:00Z`);
                return (
                  <th key={d} className="px-1 py-1 border-b border-line font-normal text-muted w-7">
                    <div>{pad(dt.getUTCDate())}</div>
                    <div className="text-[10px]">{WD[dt.getUTCDay()]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {emps.map((e) => {
              let present = 0;
              let absent = 0;
              const cells = days.map((d) => {
                const rec = recIndex.get(`${e.id}|${d}`);
                if (rec?.status === 'present' || rec?.status === 'late') present += 1;
                if (rec?.status === 'absent') absent += 1;
                return { d, ...cellFor(d, rec, e.createdAt.slice(0, 10)) };
              });
              const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
              return (
                <tr key={e.id}>
                  <td className="sticky left-0 z-10 bg-panel px-3 py-1.5 border-b border-line whitespace-nowrap">
                    {e.name}
                  </td>
                  <td className="px-2 py-1.5 text-center border-b border-line font-semibold">{present}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line font-semibold">{absent}</td>
                  <td className="px-2 py-1.5 text-center border-b border-line">{pct}%</td>
                  {cells.map((c) => (
                    <td
                      key={c.d}
                      title={`${c.d}${c.t ? ` · ${c.t}` : ''}`}
                      className={`w-7 h-6 text-center border-b border-l border-line ${c.cls}`}
                    >
                      {c.t}
                    </td>
                  ))}
                </tr>
              );
            })}
            {emps.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={4 + days.length}>
                  No employees yet. Go to <b>Team</b> and click <b>Sync from Slack</b> to import
                  your workspace members.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-muted text-xs mt-2">
        Legend: <b className="text-emerald-300">P</b> present (late counts as present) ·{' '}
        <b className="text-red-400">A</b> absent · <b>Off</b> off day / Sunday ·{' '}
        <b>L</b> leave · <b>½</b> half day · <b>–</b> before joining · blank = not recorded.
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
      await api('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({ employeeId, date, status }),
      });
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
