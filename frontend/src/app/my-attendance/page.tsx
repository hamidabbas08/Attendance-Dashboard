'use client';

import { useMemo, useState } from 'react';
import { Guard, PageHeader, SegTabs, Select, StatTile, TableSkeleton, TilesSkeleton } from '../../components/ui';
import { tally } from '../../lib/attendance';
import { useAuth } from '../../lib/auth';
import { P } from '../../lib/permissions';
import { ScreenActivityTab } from '../../components/scrin';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { MonthlyBreakdownTable } from '../../components/my-attendance/MonthlyBreakdownTable';
import { RecordsTable } from '../../components/my-attendance/RecordsTable';
import { ShiftCard } from '../../components/my-attendance/ShiftCard';

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

interface Shift { name: string; startTime: string; endTime: string; graceMins: number }

function MyAttendance() {
  const { me } = useAuth();
  const { data, loading } = useFetch<Record[]>('/api/attendance/me');
  const meInfo = useFetch<{ shift: Shift | null }>('/api/employees/me');
  const holidays = useFetch<{ date: string }[]>('/api/holidays');
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);
  const shift = meInfo.data?.shift ?? null;
  const all = data ?? [];
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [tab, setTab] = useState<'attendance' | 'activity'>('attendance');

  const years = useMemo(() => {
    const s = new Set<number>([curYear]);
    for (const r of all) s.add(Number(r.date.slice(0, 4)));
    return [...s].sort((a, b) => b - a);
  }, [all, curYear]);

  const yearRecords = useMemo(
    () => all.filter((r) => r.date.startsWith(`${year}-`)),
    [all, year],
  );
  const yearly = tally(yearRecords, holidaySet);
  const byMonth = useMemo(
    () => MONTHS.map((_, i) => tally(yearRecords.filter((r) => Number(r.date.slice(5, 7)) === i + 1), holidaySet)),
    [yearRecords, holidaySet],
  );

  return (
    <>
      <PageHeader
        title="My Attendance"
        description="Your yearly and monthly present / absent summary."
        actions={
          tab === 'attendance' ? (
            <Select
              label="Year"
              className="!w-auto min-w-[104px] font-medium"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              options={years.map((y) => ({ value: y, label: y }))}
            />
          ) : undefined
        }
      />

      <ShiftCard shift={shift} />

      <div className="mb-5">
        <SegTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'attendance', label: 'Attendance' },
            { value: 'activity', label: 'Screen Activity' },
          ]}
        />
      </div>

      {tab === 'activity' ? (
        me && me.employeeId && <ScreenActivityTab employeeId={me.employeeId} />
      ) : loading && !data ? (
        <>
          <TilesSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
      <>
      {/* Yearly totals */}
      <div className={`${ui.grid} mb-5`}>
        <StatTile label={`Present in ${year}`} value={yearly.present} accent="#34d399" />
        <StatTile label={`Absent in ${year}`} value={yearly.absent} accent="#f87171" />
        <StatTile label="On leave" value={yearly.leave} accent="#38bdf8" />
        <StatTile label="Attendance %" value={`${yearly.pct}%`} accent="#a78bfa" />
      </div>

      <MonthlyBreakdownTable year={year} months={MONTHS} byMonth={byMonth} />

      <RecordsTable year={year} records={yearRecords} holidaySet={holidaySet} />
      </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <MyAttendance />
    </Guard>
  );
}
