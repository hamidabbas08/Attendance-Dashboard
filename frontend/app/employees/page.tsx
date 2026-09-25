'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
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
      <h2>Employees</h2>

      {can('employees:create') && (
        <div className="card">
          <form className="row" onSubmit={add}>
            <div style={{ flex: 1 }}>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ flex: 1 }}>
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button>Add employee</button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              {can('employees:delete') && <th></th>}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.email}</td>
                <td>{e.status}</td>
                {can('employees:delete') && (
                  <td>
                    <button className="ghost" onClick={() => remove(e.id)}>
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
