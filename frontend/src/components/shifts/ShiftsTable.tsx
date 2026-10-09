'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Avatar, Button, EmptyState, SectionCard, Table, TableSkeleton, Td, Th, Tr } from '../ui';
import { ui } from '../../lib/ui';

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

export function ShiftsTable({
  employees, shiftById, editable, loading,
}: {
  employees: Employee[]; shiftById: Map<string, Shift>; editable: boolean; loading: boolean;
}) {
  if (loading) return <TableSkeleton rows={8} cols={editable ? 5 : 4} />;
  if (employees.length === 0) {
    return (
      <SectionCard bodyClassName="!p-0">
        <EmptyState title="No employees yet" description="People sync automatically from your Slack #attendance channel after they sign in." />
      </SectionCard>
    );
  }
  return (
    <SectionCard bodyClassName="!p-0">
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Grace (min)</Th>
              {editable && <Th align="right">Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <ShiftRow
                key={e.id}
                employee={e}
                shift={e.shiftId ? shiftById.get(e.shiftId) : undefined}
                editable={editable}
              />
            ))}
          </tbody>
        </Table>
      </div>
    </SectionCard>
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
    <Tr>
      <Td className="whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={32} />
          <Link href={`/employee/${employee.id}`} className="font-medium hover:text-accent transition-colors duration-150">
            {employee.name}
          </Link>
        </div>
      </Td>
      <Td>
        <input lang="en-US" type="time" className={inputCls} value={startTime} disabled={!editable} onChange={(e) => setStart(e.target.value)} />
      </Td>
      <Td>
        <input lang="en-US" type="time" className={inputCls} value={endTime} disabled={!editable} onChange={(e) => setEnd(e.target.value)} />
      </Td>
      <Td>
        <input type="number" min={0} max={240} className={`${ui.input} !w-20`} value={graceMins} disabled={!editable} onChange={(e) => setGrace(Number(e.target.value))} />
      </Td>
      {editable && (
        <Td align="right">
          <div className="flex items-center justify-end gap-2">
            {state === 'error' && <span className={ui.error}>{error}</span>}
            <Button
              variant={state === 'saved' ? 'secondary' : 'primary'}
              className="!py-1.5 !px-3"
              onClick={save}
              disabled={state === 'saving'}
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved ✓' : 'Save'}
            </Button>
          </div>
        </Td>
      )}
    </Tr>
  );
}
