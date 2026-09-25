'use client';

import { StatusPill, Guard } from '../../lib/components';
import { P } from '../../lib/permissions';
import { ui } from '../../lib/ui';
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
      <h2 className={ui.h2}>Company Attendance</h2>
      <div className={ui.card}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Date</th>
              <th className={ui.th}>Employee</th>
              <th className={ui.th}>Check in</th>
              <th className={ui.th}>Check out</th>
              <th className={ui.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className={ui.td}>{r.date}</td>
                <td className={`${ui.td} text-muted`}>{r.employeeId.slice(0, 8)}…</td>
                <td className={ui.td}>{r.checkIn ?? '—'}</td>
                <td className={ui.td}>{r.checkOut ?? '—'}</td>
                <td className={ui.td}>
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
