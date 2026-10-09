'use client';

import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatTile, Table, TableSkeleton, Td, Th, Tr, TilesSkeleton } from '../ui';
import { to12h, ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { computeDays, Employee, fmtH, MONTHS, rangeFor, Record, Shift, shiftLength } from './calc';
import { PeriodControls } from './PeriodControls';
import { ShiftBanner } from './ShiftBanner';

function fmtDur(h: number) {
  return fmtH(h);
}

export function PersonalOvertime() {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());

  const meInfo = useFetch<{ employee: Employee | null; shift: Shift | null }>('/api/employees/me');
  const attendance = useFetch<Record[]>('/api/attendance/me');

  const { from, to } = rangeFor(year, month);
  const shiftHrs = shiftLength(meInfo.data?.shift);
  const { days, totalOt, totalWorked, daysWithTimes } = useMemo(() => {
    const recs = (attendance.data ?? []).filter((r) => r.date >= from && r.date <= to);
    return computeDays(recs, shiftHrs);
  }, [attendance.data, from, to, shiftHrs]);

  const loading = attendance.loading && !attendance.data;
  const period = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;

  return (
    <>
      <PageHeader
        title="My Overtime"
        description="Your hours worked beyond the standard shift."
        actions={<PeriodControls year={year} setYear={setYear} month={month} setMonth={setMonth} curYear={curYear} />}
      />

      <ShiftBanner shift={meInfo.data?.shift ?? null} />

      {loading ? (
        <>
          <div className={`${ui.grid} mb-5`}><TilesSkeleton count={3} /></div>
          <TableSkeleton rows={6} cols={5} />
        </>
      ) : (
        <>
          <div className={`${ui.grid} mb-5`}>
            <StatTile label={`My overtime · ${period}`} value={fmtH(totalOt)} accent="#f59e0b" />
            <StatTile label="Days logged" value={daysWithTimes} accent="#38bdf8" />
            <StatTile label="Total worked" value={fmtH(totalWorked)} accent="#a78bfa" />
          </div>

          <SectionCard title={`Daily overtime · ${period}`} bodyClassName="!p-0">
            {days.length === 0 ? (
              <EmptyState title="No attendance recorded" description={`Nothing logged for ${period}. Your days fill in as you sign in and out in Slack.`} />
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Sign in</Th>
                    <Th>Sign out</Th>
                    <Th align="right">Worked</Th>
                    <Th align="right">Overtime</Th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <Tr key={d.date}>
                      <Td className="font-medium tabular-nums">{d.date}</Td>
                      <Td className="tabular-nums">{d.checkIn ? to12h(d.checkIn) : '—'}</Td>
                      <Td className="tabular-nums">{d.checkOut ? to12h(d.checkOut) : '—'}</Td>
                      <Td align="right" className="tabular-nums">{d.worked != null ? fmtDur(d.worked) : '—'}</Td>
                      <Td align="right" className={`tabular-nums ${d.ot > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}`}>
                        {d.ot > 0 ? `+${fmtDur(d.ot)}` : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </div>
            )}
          </SectionCard>

          <p className="text-muted text-xs mt-3">
            Overtime applies from Oct 5, 2026 onward — time worked beyond the person&apos;s assigned shift
            (9h default). It is counted only after sign-out; days with just a sign-in show worked hours but
            no overtime yet.
          </p>
        </>
      )}
    </>
  );
}
