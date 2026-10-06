'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Avatar, Guard, SectionCard, StatTile, StatusPill, TableSkeleton, TilesSkeleton } from '../../../lib/components';
import { displayStatus, tally } from '../../../lib/attendance';
import { P } from '../../../lib/permissions';
import { to12h, ui } from '../../../lib/ui';
import { useFetch } from '../../../lib/useFetch';

interface Rec {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}
interface Employee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
  roles?: string[];
  status?: string;
}
const ROLE_LABEL: Record<string, string> = {
  platform_admin: 'Platform Admin', company_owner: 'Owner', company_admin: 'Admin', cto: 'CTO',
  hr_manager: 'HR Manager', operations_manager: 'Operations Manager', manager: 'Manager',
  team_lead: 'Team Lead', product_manager: 'Product Manager', developer: 'Developer',
  business_developer: 'Business Developer', designer: 'Designer', employee: 'Employee',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function EmployeeAttendance() {
  const params = useParams();
  const id = String(params.id);
  const emp = useFetch<Employee>(`/api/employees/${id}`);
  const { data, loading } = useFetch<Rec[]>(`/api/attendance?employeeId=${id}`);
  const holidays = useFetch<{ date: string }[]>('/api/holidays');
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);

  const all = data ?? [];
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);

  const years = useMemo(() => {
    const s = new Set<number>([curYear]);
    for (const r of all) s.add(Number(r.date.slice(0, 4)));
    return [...s].sort((a, b) => b - a);
  }, [all, curYear]);

  const yearRecords = useMemo(() => all.filter((r) => r.date.startsWith(`${year}-`)), [all, year]);
  const yearly = tally(yearRecords, holidaySet);
  const byMonth = useMemo(
    () => MONTHS.map((_, i) => tally(yearRecords.filter((r) => Number(r.date.slice(5, 7)) === i + 1), holidaySet)),
    [yearRecords, holidaySet],
  );

  const roles = emp.data?.roles?.length ? emp.data.roles : emp.data?.role ? [emp.data.role] : [];
  const roleText = roles.map((r) => ROLE_LABEL[r] ?? r).join(', ');

  return (
    <>
      <Link href="/team" className="text-muted text-sm hover:text-fg">← Back to Team</Link>

      <div className="surface p-5 my-4 flex items-center gap-4 flex-wrap">
        <Avatar src={emp.data?.avatarUrl} name={emp.data?.name ?? '?'} size={56} />
        <div className="min-w-0">
          <div className="text-xl font-bold truncate">{emp.data?.name ?? '…'}</div>
          <div className="text-muted text-sm truncate">{emp.data?.email || '—'}</div>
          <div className="mt-1 flex flex-wrap gap-2">
            {roleText && <span className="pill pill-leave">{roleText}</span>}
            {emp.data?.status === 'terminated' && <span className="pill pill-absent">terminated</span>}
          </div>
        </div>
        <div className="ml-auto">
          <label className={ui.label}>Year</label>
          <select className={ui.input} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <>
          <TilesSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
        <>
          <div className={`${ui.grid} mb-5`}>
            <StatTile label={`Present in ${year}`} value={yearly.present} accent="#34d399" />
            <StatTile label={`Absent in ${year}`} value={yearly.absent} accent="#f87171" />
            <StatTile label="On leave" value={yearly.leave} accent="#38bdf8" />
            <StatTile label="Attendance %" value={`${yearly.pct}%`} accent="#a78bfa" />
          </div>

          <SectionCard className="mb-5" title={`Monthly breakdown · ${year}`} bodyClassName="!p-0">
            <div className="overflow-x-auto">
            <table className={ui.table}>
              <thead>
                <tr>
                  <th className={ui.th}>Month</th>
                  <th className={`${ui.th} text-right`}>Present</th>
                  <th className={`${ui.th} text-right`}>Absent</th>
                  <th className={`${ui.th} text-right`}>%</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.map((m, i) => (
                  <tr key={i} className="transition-colors duration-150 hover:bg-white/[0.025]">
                    <td className={`${ui.td} font-medium`}>{MONTHS[i]}</td>
                    <td className={`${ui.td} text-right tabular-nums text-emerald-300 font-semibold`}>{m.present}</td>
                    <td className={`${ui.td} text-right tabular-nums text-danger font-semibold`}>{m.absent}</td>
                    <td className={`${ui.td} text-right tabular-nums`}>{m.present + m.absent > 0 ? `${m.pct}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </SectionCard>

          <SectionCard title={`Records · ${year}`} subtitle={`${yearRecords.length} days`} bodyClassName="!p-0">
            <div className="overflow-x-auto">
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
                {[...yearRecords].sort((a, b) => b.date.localeCompare(a.date)).map((r) => (
                  <tr key={r.id} className="transition-colors duration-150 hover:bg-white/[0.025]">
                    <td className={`${ui.td} font-medium tabular-nums`}>{r.date}</td>
                    <td className={`${ui.td} tabular-nums`}>{r.checkIn ? to12h(r.checkIn) : '—'}</td>
                    <td className={`${ui.td} tabular-nums`}>{r.checkOut ? to12h(r.checkOut) : '—'}</td>
                    <td className={ui.td}><StatusPill status={displayStatus(r, holidaySet)} /></td>
                  </tr>
                ))}
                {yearRecords.length === 0 && (
                  <tr>
                    <td className={`${ui.td} text-muted text-center py-8`} colSpan={4}>No attendance records for {year}.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <Guard perm={P.ATTENDANCE_VIEW_ALL}>
      <EmployeeAttendance />
    </Guard>
  );
}
