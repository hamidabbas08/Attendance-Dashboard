import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { useFetch } from '../useFetch';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
}

export function Shifts() {
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
      <h2>Shifts</h2>
      {can('shifts:create') && (
        <div className="card">
          <form className="row" onSubmit={add}>
            <div style={{ flex: 1 }}>
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label>Start</label>
              <input value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            </div>
            <div>
              <label>End</label>
              <input value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
            </div>
            <div>
              <label>Grace (min)</label>
              <input
                type="number"
                value={form.graceMins}
                onChange={(e) => setForm({ ...form, graceMins: Number(e.target.value) })}
              />
            </div>
            <button>Add shift</button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Start</th>
              <th>End</th>
              <th>Grace</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.startTime}</td>
                <td>{s.endTime}</td>
                <td>{s.graceMins} min</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
