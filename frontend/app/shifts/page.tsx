'use client';

import { FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
}

function Shifts() {
  const { can } = useAuth();
  const { data, reload } = useFetch<Shift[]>('/api/shifts');
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '18:00', graceMins: 15 });
  const [error, setError] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/shifts', { method: 'POST', body: JSON.stringify(form) });
      reload();
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  return (
    <>
      <h2 className={ui.h2}>Shifts</h2>
      {can('shifts:create') && (
        <div className={ui.card}>
          <form className="flex gap-3 items-end" onSubmit={add}>
            <div className="flex-1">
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className={ui.label}>Start</label>
              <input className={ui.input} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>End</label>
              <input className={ui.input} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <div>
              <label className={ui.label}>Grace (min)</label>
              <input
                className={ui.input}
                type="number"
                value={form.graceMins}
                onChange={(e) => setForm({ ...form, graceMins: Number(e.target.value) })}
              />
            </div>
            <button className={ui.btn}>Add shift</button>
          </form>
          {error && <div className={ui.error}>{error}</div>}
        </div>
      )}
      <div className={ui.card}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Start</th>
              <th className={ui.th}>End</th>
              <th className={ui.th}>Grace</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id}>
                <td className={ui.td}>{s.name}</td>
                <td className={ui.td}>{s.startTime}</td>
                <td className={ui.td}>{s.endTime}</td>
                <td className={ui.td}>{s.graceMins} min</td>
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
    <Guard perm={P.SHIFTS_VIEW}>
      <Shifts />
    </Guard>
  );
}
