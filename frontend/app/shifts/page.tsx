'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  shiftId: string | null;
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

  return (
    <>
      <h2 className={ui.h2}>Shifts</h2>
      <p className={`${ui.muted} text-sm mb-4`}>
        Set each employee&apos;s working hours below. Attendance is marked late when someone
        checks in after their start time plus the grace period.
      </p>
      <div className={`${ui.card} overflow-x-auto`}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Employee</th>
              <th className={ui.th}>Start</th>
              <th className={ui.th}>End</th>
              <th className={ui.th}>Grace (min)</th>
              {editable && <th className={ui.th}></th>}
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
            {employees.data?.length === 0 && (
              <tr>
                <td className={`${ui.td} text-muted`} colSpan={editable ? 5 : 4}>
                  No employees yet. Go to <b>Team</b> and click <b>Sync from Slack</b>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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

  const inputCls = `${ui.input} !w-28`;
  return (
    <tr>
      <td className={ui.td}>{employee.name}</td>
      <td className={ui.td}>
        <input type="time" className={inputCls} value={startTime} disabled={!editable} onChange={(e) => setStart(e.target.value)} />
      </td>
      <td className={ui.td}>
        <input type="time" className={inputCls} value={endTime} disabled={!editable} onChange={(e) => setEnd(e.target.value)} />
      </td>
      <td className={ui.td}>
        <input type="number" min={0} max={240} className={`${ui.input} !w-20`} value={graceMins} disabled={!editable} onChange={(e) => setGrace(Number(e.target.value))} />
      </td>
      {editable && (
        <td className={ui.td}>
          <button className={ui.btn} onClick={save} disabled={state === 'saving'}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
          {state === 'error' && <span className={`${ui.error} ml-2`}>{error}</span>}
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
