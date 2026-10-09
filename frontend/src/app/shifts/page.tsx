'use client';

import { Guard, PageHeader } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';
import { ShiftsTable } from '../../components/shifts/ShiftsTable';

interface Employee {
  id: string;
  name: string;
  shiftId: string | null;
  avatarUrl?: string | null;
}
interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  graceMins: number;
}

function Shifts() {
  const { can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const shifts = useFetch<Shift[]>('/api/shifts');
  const editable = can('shifts:update');

  const shiftById = new Map((shifts.data ?? []).map((s) => [s.id, s]));
  const loading = employees.loading && !employees.data;

  return (
    <>
      <PageHeader
        title="Shifts"
        description="Set each person's working hours. A check-in after start time plus the grace period is marked late."
      />
      <ShiftsTable employees={employees.data ?? []} shiftById={shiftById} editable={editable} loading={loading} />
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.SHIFTS_VIEW}>
      <Shifts />
    </Guard>
  );
}
