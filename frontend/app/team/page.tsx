'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard, TableSkeleton } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  slackUserId: string | null;
  role: string;
  status: string;
}

const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'company_admin', label: 'Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

function Team() {
  const { me, can } = useAuth();
  const employees = useFetch<Employee[]>('/api/employees');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const canRole = can('users:update');
  const canEdit = can('employees:update');
  const canDelete = can('employees:delete');

  async function syncFromSlack() {
    setSyncing(true); setError(''); setMsg('');
    try {
      const res = await api<{ imported: number; updated: number; total: number }>('/api/slack/sync-members', { method: 'POST' });
      setMsg(`Synced ${res.total} members — ${res.imported} added, ${res.updated} updated.`);
      employees.reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSyncing(false);
    }
  }

  const loading = employees.loading && !employees.data;
  // Only current (active) team members appear here; former members keep their
  // history but drop off the roster.
  const roster = (employees.data ?? []).filter((e) => e.status === 'active');

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
        People are pulled from Slack (name &amp; email). Assign anyone a role — it applies when they
        sign in. Roles are enforced by the backend, not just the UI.
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
              {roster.map((e) => (
                <TeamRow
                  key={e.id}
                  employee={e}
                  isSelf={e.id === me?.employeeId}
                  canRole={canRole}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onChange={() => employees.reload()}
                />
              ))}
              {roster.length === 0 && (
                <tr><td className={`${ui.td} text-muted`} colSpan={5}>No team members yet — click <b>Sync from Slack</b>.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function TeamRow({
  employee, isSelf, canRole, canEdit, canDelete, onChange,
}: {
  employee: Employee; isSelf: boolean;
  canRole: boolean; canEdit: boolean; canDelete: boolean; onChange: () => void;
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
  async function remove() {
    if (!confirm(`Remove ${employee.name} from the team? Their past attendance is kept.`)) return;
    setBusy(true); setErr('');
    try { await api(`/api/employees/${employee.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'inactive' }) }); onChange(); }
    catch (e) { setErr((e as ApiError).message); setBusy(false); }
  }

  return (
    <tr>
      <td className={`${ui.td} whitespace-nowrap`}>
        {editing ? <input className={`${ui.input} !w-44`} value={name} onChange={(e) => setName(e.target.value)} /> : employee.name}
        {isSelf && <span className="text-muted"> (you)</span>}
      </td>
      <td className={ui.td}>
        {editing ? <input className={`${ui.input} !w-56`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" /> : (employee.email || '—')}
      </td>
      <td className={ui.td}>
        {canRole && !isSelf ? (
          <select className={`${ui.input} !w-40`} value={employee.role} onChange={(e) => patch({ role: e.target.value })}>
            {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <span className="pill pill-leave">{ROLE_OPTIONS.find((o) => o.value === employee.role)?.label ?? employee.role}</span>
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
                Remove
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
