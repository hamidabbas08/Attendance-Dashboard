import { StatusPill } from '../components';
import { useFetch } from '../useFetch';

interface Record {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

export function MyAttendance() {
  const { data } = useFetch<Record[]>('/api/attendance/me');
  return (
    <>
      <h2>My Attendance</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Check in</th>
              <th>Check out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.checkIn ?? '—'}</td>
                <td>{r.checkOut ?? '—'}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">
                  No attendance records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
