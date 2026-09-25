'use client';

import { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
  status: string;
  slackUserId: string | null;
}
interface Employee {
  id: string;
  name: string;
  email: string;
  slackUserId: string | null;
  status: string;
}

const ROLE_OPTIONS = [
  { value: 'company_owner', label: 'Owner' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'employee', label: 'Employee' },
];

function roleLabel(roles: string[]): string {
  const r = roles[0];
  return ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r ?? '—';
}

function Team() {
  const { me } = useAuth();
  const users = useFetch<User[]>('/api/users');
  const employees = useFetch<Employee[]>('/api/employees');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function syncFromSlack() {
    setSyncing(true);
    setError('');
    setMsg('');
    try {
      const res = await api<{ imported: number; updated: number; total: number }>(
        '/api/slack/sync-members',
        { method: 'POST' },
      );
      setMsg(`Synced ${res.total} members — ${res.imported} added, ${res.updated} updated.`);
      employees.reload();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSyncing(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    setError('');
    try {
      await api(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ roles: [role] }) });
      users.reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className={ui.h2}>Team</h2>
        <button className={ui.btn} onClick={syncFromSlack} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync from Slack'}
        </button>
      </div>
      {msg && <div className={`${ui.card} text-emerald-300`}>{msg}</div>}
      {error && <div className={`${ui.card} text-danger`}>{error}</div>}

      <div className={ui.card}>
        <h3 className="font-semibold mb-1">Accounts &amp; roles</h3>
        <p className={`${ui.muted} text-[13px] mb-3`}>
          People appear here once they sign in with Slack. Assign each person a role — it
          takes effect on their next request. Roles are enforced by the backend, not just the UI.
        </p>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Email</th>
              <th className={ui.th}>Role</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className={ui.td}>
                  {u.name}
                  {u.id === me?.userId && <span className="text-muted"> (you)</span>}
                </td>
                <td className={ui.td}>{u.email}</td>
                <td className={ui.td}>
                  <select
                    className={ui.input}
                    value={u.roles[0] ?? 'employee'}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                    disabled={u.id === me?.userId}
                    title={u.id === me?.userId ? 'You cannot change your own role' : roleLabel(u.roles)}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </td>
                <td className={ui.td}>{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={ui.card}>
        <h3 className="font-semibold mb-1">Employees (from Slack)</h3>
        <p className={`${ui.muted} text-[13px] mb-3`}>
          These are the workspace members tracked for attendance. Use <b>Sync from Slack</b> to
          pull the latest list — there is no manual add.
        </p>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Email</th>
              <th className={ui.th}>Slack ID</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(employees.data ?? []).map((e) => (
              <tr key={e.id}>
                <td className={ui.td}>{e.name}</td>
                <td className={ui.td}>{e.email || '—'}</td>
                <td className={`${ui.td} text-muted`}>{e.slackUserId ?? '—'}</td>
                <td className={ui.td}>{e.status}</td>
              </tr>
            ))}
            {employees.data?.length === 0 && (
              <tr>
                <td className={`${ui.td} text-muted`} colSpan={4}>
                  No employees yet — click <b>Sync from Slack</b>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
