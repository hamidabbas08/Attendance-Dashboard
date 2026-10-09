'use client';

import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Guard, PageHeader, SegTabs } from '../../components/ui';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';
import { Employee } from '../../components/team/roles';
import { TeamTable } from '../../components/team/TeamTable';

type TeamFilter = 'active' | 'terminated' | 'all';
const FILTERS: { value: TeamFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All' },
];

function Team() {
  const { me, can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const [filter, setFilter] = useState<TeamFilter>('active');

  const canRole = can('users:update');

  const loading = employees.loading && !employees.data;
  const all = employees.data ?? [];
  const counts = {
    active: all.filter((e) => e.status === 'active').length,
    terminated: all.filter((e) => e.status === 'terminated').length,
    all: all.length,
  };
  // Filter the roster by the selected tab. "Terminated" people keep their
  // history (and their pre-termination attendance) but drop off the Active list.
  const roster = all.filter((e) =>
    filter === 'all' ? true : filter === 'terminated' ? e.status === 'terminated' : e.status === 'active',
  );

  return (
    <>
      <PageHeader
        title="Team"
        description="Manage people, roles and access. The roster mirrors your Slack #attendance channel."
        actions={
          <SegTabs
            value={filter}
            onChange={setFilter}
            options={FILTERS.map((f) => ({ value: f.value, label: <>{f.label} <span className="opacity-60">· {counts[f.value]}</span></> }))}
          />
        }
      />

      <TeamTable
        roster={roster}
        loading={loading}
        meEmployeeId={me?.employeeId}
        canRole={canRole}
        onChange={() => employees.reload()}
        emptyTitle={filter === 'terminated' ? 'No terminated members' : 'No team members yet'}
        emptyDescription={filter === 'terminated'
          ? 'Members who leave the Slack channel will appear here, with their history preserved.'
          : 'Team members sync automatically from your Slack #attendance channel after they sign in.'}
      />
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.USERS_VIEW}>
      <Team />
    </Guard>
  );
}
