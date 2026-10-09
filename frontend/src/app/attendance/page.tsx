'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Guard, PageHeader, Select } from '../../components/ui';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';
import { AttendanceGrid } from '../../components/attendance/AttendanceGrid';
import { daysInRange, Employee, isActive, MONTHS, pad, Record, today } from '../../components/attendance/calc';
import { HolidaysDropdown } from '../../components/attendance/HolidaysDropdown';
import { MarkAttendanceForm } from '../../components/attendance/MarkAttendanceForm';
import { PullButton } from '../../components/attendance/PullButton';

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

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Company-wide daily attendance, holidays and manual adjustments."
        actions={
          <>
            {can('employees:create') && <PullButton onDone={() => attendance.reload()} />}
            <HolidaysDropdown holidays={holidays.data ?? []} year={year} month={month} />
            <Select
              label="Year"
              className="!w-auto min-w-[88px] font-medium"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              options={[curYear - 1, curYear, curYear + 1].map((y) => ({ value: y, label: y }))}
            />
            <Select
              label="Month"
              className="!w-auto min-w-[150px] font-medium"
              value={month}
              onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              options={[{ value: 'all', label: 'Full year (to date)' }, ...MONTHS.map((m, i) => ({ value: i, label: m }))]}
            />
          </>
        }
      />

      {can('attendance:update') && (
        <MarkAttendanceForm
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

      <AttendanceGrid
        emps={emps}
        days={days}
        monthGroups={monthGroups}
        recIndex={recIndex}
        earliestRecord={earliestRecord}
        holidayByDate={holidayByDate}
        stretch={stretch}
      />

      <p className="text-muted text-xs mt-2">
        Legend: <b className="text-emerald-300">P</b> present (late counts as present) ·{' '}
        <b className="text-red-400">A</b> absent · <b className="text-amber-300/70">•</b> signed in, awaiting sign-out ·{' '}
        <b>Off</b> off day / Sunday &amp; Saturday (from Oct 3, 2026) / holiday ·{' '}
        <b>L</b> leave · <b>½</b> half day · blank = not recorded.
      </p>
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <Attendance />
    </Guard>
  );
}
