'use client';

import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { useFetch } from '../../lib/useFetch';

interface Record {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

function Attendance() {
  const { data } = useFetch<Record[]>('/api/attendance');
  return (
    <>
      <h2>Company Attendance</h2>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Employee</th>
              <th>Check in</th>
              <th>Check out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td className="muted">{r.employeeId.slice(0, 8)}…</td>
                <td>{r.checkIn ?? '—'}</td>
                <td>{r.checkOut ?? '—'}</td>
                <td>
                  <StatusPill status={r.status} />
                </td>
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
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <Attendance />
    </Guard>
  );
}
