'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Guard, TableSkeleton } from '../../lib/components';
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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h2 className={ui.h2}>Team</h2>
          <p className={ui.subtitle}>Manage people, roles and access</p>
        </div>
      </div>

      <p className={`${ui.muted} text-[13px] mb-4`}>
        The team mirrors your Slack #attendance channel: members sync automatically (name, email &amp;
        avatar), and anyone who leaves or is removed from the channel is moved to Terminated (their
        history is kept). Assign anyone a role — it applies when they sign in and is enforced by the backend.
      </p>

      <div className="flex gap-2 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm border transition ${
              filter === f.value
                ? 'bg-accent text-ink border-transparent font-semibold'
                : 'border-line text-muted hover:bg-panel2'
            }`}
          >
            {f.label} <span className="opacity-70">({counts[f.value]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <div className="surface p-5 overflow-x-auto">
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Name</th>
                <th className={ui.th}>Email</th>
                <th className={ui.th}>Role</th>
                <th className={ui.th}>Status</th>
                {canEdit && <th className={ui.th}>Actions</th>}
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
              {roster.length === 0 && (
                <tr>
                  <td className={`${ui.td} text-muted`} colSpan={5}>
                    {filter === 'terminated'
                      ? 'No terminated members.'
                      : filter === 'active'
                        ? 'No active team members yet — they sync from Slack after login.'
                        : 'No team members yet — they sync from Slack after login.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
    <tr>
      <td className={`${ui.td} whitespace-nowrap`}>
        <div className="flex items-center gap-2.5">
          <Avatar src={employee.avatarUrl} name={employee.name} size={30} />
          {editing ? (
            <input className={`${ui.input} !w-44`} value={name} onChange={(e) => setName(e.target.value)} />
          ) : (
            <span>
              {employee.name}
              {isSelf && <span className="text-muted"> (you)</span>}
            </span>
          )}
        </div>
      </td>
      <td className={ui.td}>
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
          <span className="text-red-300">
            terminated{employee.terminatedAt ? ` · ${employee.terminatedAt}` : ''}
          </span>
        ) : (
          employee.status
        )}
      </td>
      {canEdit && (
        <td className={ui.td}>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button className={ui.btn} onClick={saveEdit} disabled={busy}>{busy ? '…' : 'Save'}</button>
                <button className={ui.btnGhost} onClick={() => { setEditing(false); setName(employee.name); setEmail(employee.email); }}>Cancel</button>
              </>
            ) : (
              <button className={ui.btnGhost} onClick={() => setEditing(true)}>Edit</button>
            )}
          </div>
          {err && <div className={ui.error}>{err}</div>}
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
