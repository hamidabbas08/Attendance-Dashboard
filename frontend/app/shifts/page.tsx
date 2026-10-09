'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, EmptyState, Guard, PageHeader, SectionCard, TableSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

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
      {loading ? (
        <TableSkeleton rows={8} cols={editable ? 5 : 4} />
      ) : (employees.data?.length ?? 0) === 0 ? (
        <SectionCard bodyClassName="!p-0">
          <EmptyState title="No employees yet" description="People sync automatically from your Slack #attendance channel after they sign in." />
        </SectionCard>
      ) : (
        <SectionCard bodyClassName="!p-0">
          <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Employee</th>
                  <th className={ui.th}>Start</th>
                  <th className={ui.th}>End</th>
                  <th className={ui.th}>Grace (min)</th>
                  {editable && <th className={`${ui.th} text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(employees.data ?? []).map((e) => (
                  <ShiftRow
                    key={e.id}
                    employee={e}
                    shift={e.shiftId ? shiftById.get(e.shiftId) : undefined}
                    editable={editable}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </>
  );
}

function ShiftRow({
  employee,
  shift,
  editable,
}: {
  employee: Employee;
  shift?: Shift;
  editable: boolean;
}) {
  const [startTime, setStart] = useState(shift?.startTime ?? '09:00');
  const [endTime, setEnd] = useState(shift?.endTime ?? '18:00');
  const [graceMins, setGrace] = useState(shift?.graceMins ?? 15);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function save() {
    setState('saving');
    setError('');
    try {
      await api(`/api/employees/${employee.id}/shift`, {
        method: 'PUT',
        body: JSON.stringify({ startTime, endTime, graceMins: Number(graceMins) }),
      });
      setState('saved');
      setTimeout(() => setState('idle'), 1500);
    } catch (err) {
      setState('error');
      setError((err as ApiError).message);
    }
  }

  const inputCls = `${ui.input} !w-36`;
  return (
    <tr className="transition-colors duration-150 hover:bg-white/[0.025]">
      <td className={`${ui.td} whitespace-nowrap`}>
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={32} />
          <Link href={`/employee/${employee.id}`} className="font-medium hover:text-accent transition-colors duration-150">
            {employee.name}
          </Link>
        </div>
      </td>
      <td className={ui.td}>
        <input lang="en-US" type="time" className={inputCls} value={startTime} disabled={!editable} onChange={(e) => setStart(e.target.value)} />
      </td>
      <td className={ui.td}>
        <input lang="en-US" type="time" className={inputCls} value={endTime} disabled={!editable} onChange={(e) => setEnd(e.target.value)} />
      </td>
      <td className={ui.td}>
        <input type="number" min={0} max={240} className={`${ui.input} !w-20`} value={graceMins} disabled={!editable} onChange={(e) => setGrace(Number(e.target.value))} />
      </td>
      {editable && (
        <td className={`${ui.td} text-right`}>
          <div className="flex items-center justify-end gap-2">
            {state === 'error' && <span className={ui.error}>{error}</span>}
            <button
              className={`${state === 'saved' ? ui.btnSecondary : ui.btn} !py-1.5 !px-3`}
              onClick={save}
              disabled={state === 'saving'}
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

export default function Page() {
  return (
    <Guard perm={P.SHIFTS_VIEW}>
      <Shifts />
    </Guard>
  );
}
