'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Avatar, EmptyState, MultiSelect, SectionCard, StatusBadge, Table, TableSkeleton, Td, Th, Tr } from '../ui';
import { ui } from '../../lib/ui';
import { Employee, ROLE_OPTIONS, roleLabel, rolesOf } from './roles';

export function TeamTable({
  roster, loading, meEmployeeId, canRole, onChange, emptyTitle, emptyDescription,
}: {
  roster: Employee[];
  loading: boolean;
  meEmployeeId?: string | null;
  canRole: boolean;
  onChange: () => void;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (loading) return <TableSkeleton rows={8} cols={4} />;
  return (
    <SectionCard bodyClassName="!p-0">
      {roster.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {roster.map((e) => (
                <TeamRow
                  key={e.id}
                  employee={e}
                  isSelf={e.id === meEmployeeId}
                  canRole={canRole}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

function TeamRow({
  employee, isSelf, canRole, onChange,
}: {
  employee: Employee; isSelf: boolean;
  canRole: boolean; onChange: () => void;
}) {
  const [err, setErr] = useState('');

  async function patch(body: Record<string, unknown>) {
    setErr('');
    try {
      await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChange();
    } catch (e) { setErr((e as ApiError).message); throw e; }
  }

  return (
    <Tr>
      <Td className="whitespace-nowrap">
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={32} />
          <span className="font-medium">
            <Link href={`/employee/${employee.id}`} className="hover:text-accent transition-colors duration-150">
              {employee.name}
            </Link>
            {isSelf && <span className="text-faint font-normal"> (you)</span>}
          </span>
        </div>
      </Td>
      <Td className="text-muted">{employee.email || '—'}</Td>
      <Td>
        {canRole && !isSelf ? (
          <>
            <MultiSelect
              options={ROLE_OPTIONS}
              selected={rolesOf(employee)}
              onChange={(roles) => patch({ roles })}
              placeholder="Select roles…"
            />
            {err && <div className={ui.error}>{err}</div>}
          </>
        ) : (
          <div className="flex flex-wrap gap-1">
            {rolesOf(employee).map((r) => (
              <span key={r} className="pill pill-leave">{roleLabel(r)}</span>
            ))}
          </div>
        )}
      </Td>
      <Td>
        {employee.status === 'terminated' ? (
          <span title={employee.terminatedAt ? `Since ${employee.terminatedAt}` : undefined}>
            <StatusBadge status="absent" label="Terminated" />
          </span>
        ) : (
          <StatusBadge status="present" label="Active" />
        )}
      </Td>
    </Tr>
  );
}
