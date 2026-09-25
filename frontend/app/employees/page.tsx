'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  shiftId: string | null;
}

function Employees() {
  const { can } = useAuth();
  const { data, reload } = useFetch<Employee[]>('/api/employees');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/employees', { method: 'POST', body: JSON.stringify({ name, email }) });
      setName('');
      setEmail('');
      reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function remove(id: string) {
    try {
      await api(`/api/employees/${id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <h2 className={ui.h2}>Employees</h2>

      {can('employees:create') && (
        <div className={ui.card}>
          <form className="flex gap-3 items-end" onSubmit={add}>
            <div className="flex-1">
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="flex-1">
              <label className={ui.label}>Email</label>
              <input className={ui.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className={ui.btn}>Add employee</button>
          </form>
          {error && <div className={ui.error}>{error}</div>}
        </div>
      )}

      <div className={ui.card}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Email</th>
              <th className={ui.th}>Status</th>
              {can('employees:delete') && <th className={ui.th}></th>}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id}>
                <td className={ui.td}>{e.name}</td>
                <td className={ui.td}>{e.email}</td>
                <td className={ui.td}>{e.status}</td>
                {can('employees:delete') && (
                  <td className={ui.td}>
                    <button className={ui.btnGhost} onClick={() => remove(e.id)}>
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.EMPLOYEES_VIEW}>
      <Employees />
    </Guard>
  );
}
