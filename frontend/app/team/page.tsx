'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard, TableSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface User { id: string; name: string; email: string; roles: string[]; status: string; slackUserId: string | null }
interface Employee { id: string; name: string; email: string; slackUserId: string | null; status: string }

const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'employee', label: 'Employee' },
];
const roleLabel = (r?: string) => ROLE_OPTIONS.find((o) => o.value === r)?.label ?? '—';

function Team() {
  const { me, can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const users = useFetch<User[]>('/api/users');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const canRole = can('users:update');
  const canEdit = can('employees:update');
  const canDelete = can('employees:delete');

  function findUser(e: Employee): User | undefined {
    return (users.data ?? []).find(
      (u) =>
        (e.slackUserId && u.slackUserId === e.slackUserId) ||
        u.name.toLowerCase() === e.name.toLowerCase(),
    );
  }

  async function syncFromSlack() {
    setSyncing(true); setError(''); setMsg('');
    try {
      const res = await api<{ imported: number; updated: number; total: number }>('/api/slack/sync-members', { method: 'POST' });
      setMsg(`Synced ${res.total} members — ${res.imported} added, ${res.updated} updated.`);
      employees.reload(); users.reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSyncing(false);
    }
  }

  const loading = employees.loading && !employees.data;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h2 className={ui.h2}>Team</h2>
          <p className={ui.subtitle}>Manage people, roles and access</p>
        </div>
        <button className={ui.btn} onClick={syncFromSlack} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync from Slack'}
        </button>
      </div>
      {msg && <div className="surface p-3 text-emerald-300 text-sm mb-4">{msg}</div>}
      {error && <div className="surface p-3 text-danger text-sm mb-4">{error}</div>}

      <p className={`${ui.muted} text-[13px] mb-4`}>
        People are pulled from Slack — there is no manual add. Assign roles, edit details, or
        remove someone. Roles are enforced by the backend, not just the UI.
      </p>

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
                {(canEdit || canDelete) && <th className={ui.th}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(employees.data ?? []).map((e) => (
                <TeamRow
                  key={e.id}
                  employee={e}
                  user={findUser(e)}
                  isSelf={findUser(e)?.id === me?.userId}
                  canRole={canRole}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onChange={() => { employees.reload(); users.reload(); }}
                />
              ))}
              {employees.data?.length === 0 && (
                <tr><td className={`${ui.td} text-muted`} colSpan={5}>No employees yet — click <b>Sync from Slack</b>.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TeamRow({
  employee, user, isSelf, canRole, canEdit, canDelete, onChange,
}: {
  employee: Employee; user?: User; isSelf: boolean;
  canRole: boolean; canEdit: boolean; canDelete: boolean; onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);
  const [email, setEmail] = useState(employee.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function changeRole(role: string) {
    if (!user) return;
    setErr('');
    try {
      await api(`/api/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ roles: [role] }) });
      onChange();
    } catch (e) { setErr((e as ApiError).message); }
  }
  async function saveEdit() {
    setBusy(true); setErr('');
    try {
      await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify({ name, email }) });
      setEditing(false); onChange();
    } catch (e) { setErr((e as ApiError).message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Remove ${employee.name}? This deletes their employee record${user ? ' and login account' : ''}.`)) return;
    setBusy(true); setErr('');
    try {
      await api(`/api/employees/${employee.id}`, { method: 'DELETE' });
      if (user && !isSelf) await api(`/api/users/${user.id}`, { method: 'DELETE' });
      onChange();
    } catch (e) { setErr((e as ApiError).message); setBusy(false); }
  }

  return (
    <tr>
      <td className={`${ui.td} whitespace-nowrap`}>
        {editing ? <input className={`${ui.input} !w-44`} value={name} onChange={(e) => setName(e.target.value)} /> : employee.name}
        {isSelf && <span className="text-muted"> (you)</span>}
      </td>
      <td className={ui.td}>
        {editing ? <input className={`${ui.input} !w-56`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" /> : (user?.email || employee.email || '—')}
      </td>
      <td className={ui.td}>
        {!user ? (
          <span className="pill pill-off_day">No login yet</span>
        ) : canRole && !isSelf ? (
          <select className={`${ui.input} !w-40`} value={user.roles[0] ?? 'employee'} onChange={(e) => changeRole(e.target.value)}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <span className="pill pill-leave">{roleLabel(user.roles[0])}</span>
        )}
      </td>
      <td className={ui.td}>{employee.status}</td>
      {(canEdit || canDelete) && (
        <td className={ui.td}>
          <div className="flex items-center gap-2">
            {canEdit && (editing ? (
              <>
                <button className={ui.btn} onClick={saveEdit} disabled={busy}>{busy ? '…' : 'Save'}</button>
                <button className={ui.btnGhost} onClick={() => { setEditing(false); setName(employee.name); setEmail(employee.email); }}>Cancel</button>
              </>
            ) : (
              <button className={ui.btnGhost} onClick={() => setEditing(true)}>Edit</button>
            ))}
            {canDelete && !isSelf && !editing && (
              <button className="border border-red-500/40 text-red-300 rounded-lg px-3 py-2.5 hover:bg-red-500/10 transition" onClick={remove} disabled={busy}>
                Delete
              </button>
            )}
          </div>
          {err && <div className={ui.error}>{err}</div>}
        </td>
      )}
    </tr>
  );
}

export default function Page() {
  return (
    <Guard perm={P.USERS_VIEW}>
      <Team />
    </Guard>
  );
}
