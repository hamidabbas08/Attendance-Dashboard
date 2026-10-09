'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Guard, SegTabs, TableSkeleton, TilesSkeleton } from '../../../components/ui';
import { tally } from '../../../lib/attendance';
import { P } from '../../../lib/permissions';
import { ScreenActivityTab } from '../../../components/scrin';
import { useFetch } from '../../../lib/useFetch';
import { AttendanceSummary } from '../../../components/employee/AttendanceSummary';
import { EmployeeHeader } from '../../../components/employee/EmployeeHeader';

interface Rec {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}
interface Employee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
  roles?: string[];
  status?: string;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function EmployeeAttendance() {
  const params = useParams();
  const id = String(params.id);
  const emp = useFetch<Employee>(`/api/employees/${id}`);
  const { data, loading } = useFetch<Rec[]>(`/api/attendance?employeeId=${id}`);
  const holidays = useFetch<{ date: string }[]>('/api/holidays');
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);

  const all = data ?? [];
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [tab, setTab] = useState<'attendance' | 'activity'>('attendance');

  const years = useMemo(() => {
    const s = new Set<number>([curYear]);
    for (const r of all) s.add(Number(r.date.slice(0, 4)));
    return [...s].sort((a, b) => b - a);
  }, [all, curYear]);

  const yearRecords = useMemo(() => all.filter((r) => r.date.startsWith(`${year}-`)), [all, year]);
  const yearly = tally(yearRecords, holidaySet);
  const byMonth = useMemo(
    () => MONTHS.map((_, i) => tally(yearRecords.filter((r) => Number(r.date.slice(5, 7)) === i + 1), holidaySet)),
    [yearRecords, holidaySet],
  );

  return (
    <>
      <EmployeeHeader
        employee={emp.data}
        showYearSelect={tab === 'attendance'}
        year={year}
        years={years}
        onYear={setYear}
      />

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
        <ScreenActivityTab employeeId={id} />
      ) : loading && !data ? (
        <>
          <TilesSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
        <AttendanceSummary
          year={year}
          months={MONTHS}
          yearly={yearly}
          byMonth={byMonth}
          yearRecords={yearRecords}
          holidaySet={holidaySet}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <EmployeeAttendance />
    </Guard>
  );
}
