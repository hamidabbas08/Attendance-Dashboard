'use client';

import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
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
      <h2 className={ui.h2}>My Attendance</h2>
      <div className={ui.card}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Date</th>
              <th className={ui.th}>Check in</th>
              <th className={ui.th}>Check out</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className={ui.td}>{r.date}</td>
                <td className={ui.td}>{r.checkIn ?? '—'}</td>
                <td className={ui.td}>{r.checkOut ?? '—'}</td>
                <td className={ui.td}>
                  <StatusPill status={r.status} />
                </td>
              </tr>
            ))}
            {data?.length === 0 && (
              <tr>
                <td className={`${ui.td} text-muted`} colSpan={4}>
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
