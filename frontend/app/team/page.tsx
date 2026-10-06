'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, EmptyState, Guard, PageHeader, SectionCard, SegTabs, StatusBadge, TableSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  slackUserId: string | null;
  role: string;
  roles?: string[];
  status: string;
  terminatedAt?: string | null;
  avatarUrl?: string | null;
}

type TeamFilter = 'active' | 'terminated' | 'all';
const FILTERS: { value: TeamFilter; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'all', label: 'All' },
];

const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'company_admin', label: 'Admin' },
  { value: 'cto', label: 'CTO' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'operations_manager', label: 'Operations Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'team_lead', label: 'Team Lead' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'developer', label: 'Developer' },
  { value: 'business_developer', label: 'Business Developer' },
  { value: 'designer', label: 'Designer' },
  { value: 'employee', label: 'Employee' },
];
const roleLabel = (v: string) => ROLE_OPTIONS.find((o) => o.value === v)?.label ?? v;
const rolesOf = (e: Employee): string[] =>
  e.roles && e.roles.length ? e.roles : e.role ? [e.role] : ['employee'];

function Team() {
  const { me, can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const [filter, setFilter] = useState<TeamFilter>('active');

  const canRole = can('users:update');
  const canEdit = can('employees:update');

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

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <SectionCard bodyClassName="!p-0">
          {roster.length === 0 ? (
            <EmptyState
              title={filter === 'terminated' ? 'No terminated members' : 'No team members yet'}
              description={filter === 'terminated'
                ? 'Members who leave the Slack channel will appear here, with their history preserved.'
                : 'Team members sync automatically from your Slack #attendance channel after they sign in.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th className={ui.th}>Name</th>
                    <th className={ui.th}>Email</th>
                    <th className={ui.th}>Role</th>
                    <th className={ui.th}>Status</th>
                    {canEdit && <th className={`${ui.th} text-right`}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {roster.map((e) => (
                    <TeamRow
                      key={e.id}
                      employee={e}
                      isSelf={e.id === me?.employeeId}
                      canRole={canRole}
                      canEdit={canEdit}
                      onChange={() => employees.reload()}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </>
  );
}

function TeamRow({
  employee, isSelf, canRole, canEdit, onChange,
}: {
  employee: Employee; isSelf: boolean;
  canRole: boolean; canEdit: boolean; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function patch(body: Record<string, unknown>) {
    setErr('');
    try {
      await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChange();
    } catch (e) { setErr((e as ApiError).message); throw e; }
  }
  async function saveEdit() {
    setBusy(true);
    try { await patch({ name, email }); setEditing(false); } catch { /* shown */ } finally { setBusy(false); }
  }

  return (
    <tr className="transition-colors duration-150 hover:bg-white/[0.025]">
      <td className={`${ui.td} whitespace-nowrap`}>
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={32} />
          {editing ? (
            <input className={`${ui.input} !w-44`} value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <span className="font-medium">
              <Link href={`/employee/${employee.id}`} className="hover:text-accent transition-colors duration-150">
                {employee.name}
              </Link>
              {isSelf && <span className="text-faint font-normal"> (you)</span>}
            </span>
          )}
        </div>
      </td>
      <td className={`${ui.td} text-muted`}>
        {editing ? <input className={`${ui.input} !w-56`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" /> : (employee.email || '—')}
      </td>
      <td className={ui.td}>
        {canRole && !isSelf ? (
          <MultiRoleSelect selected={rolesOf(employee)} onChange={(roles) => patch({ roles })} />
        ) : (
          <div className="flex flex-wrap gap-1">
            {rolesOf(employee).map((r) => (
              <span key={r} className="pill pill-leave">{roleLabel(r)}</span>
            ))}
          </div>
        )}
      </td>
      <td className={ui.td}>
        {employee.status === 'terminated' ? (
          <span title={employee.terminatedAt ? `Since ${employee.terminatedAt}` : undefined}>
            <StatusBadge status="absent" label="Terminated" />
          </span>
        ) : (
          <StatusBadge status="present" label="Active" />
        )}
      </td>
      {canEdit && (
        <td className={`${ui.td} text-right`}>
          <div className="flex items-center justify-end gap-2">
            {editing ? (
              <>
                <button className={`${ui.btn} !py-1.5 !px-3`} onClick={saveEdit} disabled={busy}>{busy ? '…' : 'Save'}</button>
                <button className={`${ui.btnGhost} !py-1.5 !px-3`} onClick={() => { setEditing(false); setName(employee.name); setEmail(employee.email); }}>Cancel</button>
              </>
            ) : (
              <button className={`${ui.btnSecondary} !py-1.5 !px-3`} onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>
          {err && <div className={`${ui.error} text-right`}>{err}</div>}
        </td>
      )}
    </tr>
  );
}

// A compact multi-select: a dropdown of checkboxes so a person can hold several
// roles/titles at once. Each toggle saves immediately.
function MultiRoleSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (roles: string[]) => void;
}) {
  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((r) => r !== value)
      : [...selected, value];
    onChange(next);
  };
  const summary = selected.length ? selected.map(roleLabel).join(', ') : 'Select roles…';
  return (
    <details className="relative">
      <summary
        className={`${ui.input} !w-52 cursor-pointer truncate list-none [&::-webkit-details-marker]:hidden`}
        title={summary}
      >
        {summary}
      </summary>
      <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto surface p-2 shadow-xl">
        {ROLE_OPTIONS.map((o) => (
          <label
            key={o.value}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-panel2 cursor-pointer text-sm"
          >
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function Page() {
  return (
    <Guard perm={P.USERS_VIEW}>
      <Team />
    </Guard>
  );
}
