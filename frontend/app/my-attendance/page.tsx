'use client';

import { useMemo, useState } from 'react';
import { StatusPill, Guard, PageHeader, SectionCard, SegTabs, StatTile, TableSkeleton, TilesSkeleton } from '../../lib/components';
import { displayStatus, tally } from '../../lib/attendance';
import { useAuth } from '../../lib/auth';
import { P } from '../../lib/permissions';
import { ScreenActivityTab } from '../../lib/scrinActivity';
import { to12h, ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';

interface Record {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Shift { name: string; startTime: string; endTime: string; graceMins: number }

function MyAttendance() {
  const { me } = useAuth();
  const { data, loading } = useFetch<Record[]>('/api/attendance/me');
  const meInfo = useFetch<{ shift: Shift | null }>('/api/employees/me');
  const holidays = useFetch<{ date: string }[]>('/api/holidays');
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);
  const shift = meInfo.data?.shift ?? null;
  const all = data ?? [];
  const curYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [tab, setTab] = useState<'attendance' | 'activity'>('attendance');

  const years = useMemo(() => {
    const s = new Set<number>([curYear]);
    for (const r of all) s.add(Number(r.date.slice(0, 4)));
    return [...s].sort((a, b) => b - a);
  }, [all, curYear]);

  const yearRecords = useMemo(
    () => all.filter((r) => r.date.startsWith(`${year}-`)),
    [all, year],
  );
  const yearly = tally(yearRecords, holidaySet);
  const byMonth = useMemo(
    () => MONTHS.map((_, i) => tally(yearRecords.filter((r) => Number(r.date.slice(5, 7)) === i + 1), holidaySet)),
    [yearRecords, holidaySet],
  );

  return (
    <>
      <PageHeader
        title="My Attendance"
        description="Your yearly and monthly present / absent summary."
        actions={
          tab === 'attendance' ? (
            <div>
              <label className={ui.label}>Year</label>
              <select className={`${ui.input} !w-auto min-w-[104px] font-medium`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          ) : undefined
        }
      />

      <div className="surface px-5 py-4 mb-5 flex items-center gap-3 flex-wrap">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent/12 text-accent ring-1 ring-accent/20 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </span>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-faint font-semibold">Your shift</div>
          {shift ? (
            <div className="font-semibold">
              {to12h(shift.startTime)} – {to12h(shift.endTime)}
              <span className="text-muted font-normal"> · {shift.graceMins}m grace{shift.name ? ` · ${shift.name}` : ''}</span>
            </div>
          ) : (
            <div className="text-muted">Not set yet — your HR/owner assigns shifts.</div>
          )}
        </div>
      </div>

      <div className="mb-5">
        <SegTabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'attendance', label: 'Attendance' },
            { value: 'activity', label: 'Screen Activity' },
          ]}
        />
      </div>

      {tab === 'activity' ? (
        me && me.employeeId && <ScreenActivityTab employeeId={me.employeeId} />
      ) : loading && !data ? (
        <>
          <TilesSkeleton count={4} />
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
      <>
      {/* Yearly totals */}
      <div className={`${ui.grid} mb-5`}>
        <StatTile label={`Present in ${year}`} value={yearly.present} accent="#34d399" />
        <StatTile label={`Absent in ${year}`} value={yearly.absent} accent="#f87171" />
        <StatTile label="On leave" value={yearly.leave} accent="#38bdf8" />
        <StatTile label="Attendance %" value={`${yearly.pct}%`} accent="#a78bfa" />
      </div>

      {/* Monthly breakdown */}
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

      {/* Daily records */}
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
    <Guard perm={P.ATTENDANCE_VIEW_OWN}>
      <MyAttendance />
    </Guard>
  );
}
