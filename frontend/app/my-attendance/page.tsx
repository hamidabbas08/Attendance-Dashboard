'use client';

import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';

interface Record {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

function MyAttendance() {
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

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <MyAttendance />
    </Guard>
  );
}
