'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Button, Input, PageHeader, SectionCard, StatTile, Table, TableSkeleton, Td, Th, TilesSkeleton } from '../ui';
import { to12h, ui } from '../../lib/ui';
import { useFetch } from '../../lib/useFetch';
import { computeDays, DayRow, Employee, fmtH, MONTHS, rangeFor, Record, ShiftRec, shiftLength } from './calc';
import { PeriodControls } from './PeriodControls';

export function TeamOvertime() {
  const { can } = useAuth();
  const canEdit = can('attendance:update');
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const [year, setYear] = useState(curYear);
  const [month, setMonth] = useState<number | 'all'>(now.getUTCMonth());
  const [open, setOpen] = useState<string | null>(null);

  const { from, to } = rangeFor(year, month);

  const employees = useFetch<Employee[]>('/api/employees');
  const attendance = useFetch<Record[]>(`/api/attendance?from=${from}&to=${to}`);
  const shifts = useFetch<ShiftRec[]>('/api/shifts');

  const rows = useMemo(() => {
    const shiftById = new Map((shifts.data ?? []).map((s) => [s.id, s]));
    const byEmp = new Map<string, Record[]>();
    for (const r of attendance.data ?? []) {
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, []);
      byEmp.get(r.employeeId)!.push(r);
    }
    const out: { employee: Employee; totalOt: number; totalWorked: number; daysWithTimes: number; days: DayRow[] }[] = [];
    for (const e of employees.data ?? []) {
      const recs = byEmp.get(e.id) ?? [];
      if (recs.length === 0) continue;
      const shiftHrs = e.shiftId ? shiftLength(shiftById.get(e.shiftId)) : null;
      const c = computeDays(recs, shiftHrs);
      if (c.daysWithTimes === 0) continue;
      out.push({ employee: e, ...c });
    }
    return out.sort((a, b) => b.totalOt - a.totalOt);
  }, [attendance.data, employees.data, shifts.data]);

  const loading = (attendance.loading && !attendance.data) || (employees.loading && !employees.data);
  const grandOt = rows.reduce((s, r) => s + r.totalOt, 0);
  const peopleWithOt = rows.filter((r) => r.totalOt > 0).length;
  const maxOt = Math.max(1, ...rows.map((r) => r.totalOt));
  const period = month === 'all' ? `${year}` : `${MONTHS[month]} ${year}`;

  return (
    <>
      <PageHeader
        title="Overtime"
        description="Hours worked beyond each person's assigned shift."
        actions={<PeriodControls year={year} setYear={setYear} month={month} setMonth={setMonth} curYear={curYear} />}
      />

      {loading ? (
        <>
          <div className={`${ui.grid} mb-5`}><TilesSkeleton count={3} /></div>
          <TableSkeleton rows={6} cols={4} />
        </>
      ) : (
        <>
          <div className={`${ui.grid} mb-5`}>
            <StatTile label={`Total overtime · ${period}`} value={fmtH(grandOt)} accent="#f59e0b" />
            <StatTile label="People with overtime" value={peopleWithOt} accent="#38bdf8" />
            <StatTile
              label="Avg per person (with OT)"
              value={fmtH(peopleWithOt ? grandOt / peopleWithOt : 0)}
              accent="#a78bfa"
            />
          </div>

          <SectionCard title={`Overtime by employee · ${period}`} bodyClassName="!p-0">
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Employee</Th>
                  <Th align="right">Days logged</Th>
                  <Th align="right">Total worked</Th>
                  <Th>Overtime</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.employee.id}>
                    <tr
                      className="cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                      onClick={() => setOpen(open === r.employee.id ? null : r.employee.id)}
                    >
                      <Td className="whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <span className="text-faint w-3">{open === r.employee.id ? '▾' : '▸'}</span>
                          <Avatar src={r.employee.avatarUrl} name={r.employee.name} size={28} />
                          <Link
                            href={`/employee/${r.employee.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium hover:text-accent transition-colors duration-150"
                          >
                            {r.employee.name}
                          </Link>
                        </div>
                      </Td>
                      <Td align="right" className="tabular-nums">{r.daysWithTimes}</Td>
                      <Td align="right" className="tabular-nums">{fmtH(r.totalWorked)}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 rounded-full bg-amber-400/80" style={{ width: `${(r.totalOt / maxOt) * 120}px` }} />
                          <span className={r.totalOt > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}>
                            {fmtH(r.totalOt)}
                          </span>
                        </div>
                      </Td>
                    </tr>
                    {open === r.employee.id && (
                      <tr>
                        <td className="bg-panel2/30 px-4 py-3 border-b border-line" colSpan={4}>
                          <div className="text-muted text-xs mb-2">
                            Each logged day — overtime is time worked beyond their shift, counted after sign-out.
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted">
                                <th className="text-left font-medium py-1">Date</th>
                                <th className="text-left font-medium py-1">Sign in</th>
                                <th className="text-left font-medium py-1">Sign out</th>
                                <th className="text-left font-medium py-1">Worked</th>
                                <th className="text-left font-medium py-1">Overtime</th>
                                {canEdit && <th className="text-left font-medium py-1">Edit</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {r.days.map((d) => (
                                <DayLine
                                  key={d.date}
                                  employeeId={r.employee.id}
                                  day={d}
                                  canEdit={canEdit}
                                  onSaved={() => attendance.reload()}
                                />
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <Td className="text-muted text-center py-8" colSpan={4}>
                      No overtime to show for {period}. It fills in as people sign in/out in Slack
                      (or when times are added manually on the Attendance page).
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
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

// One day in the per-employee breakdown, with inline editing of the times.
function DayLine({
  employeeId,
  day,
  canEdit,
  onSaved,
}: {
  employeeId: string;
  day: DayRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [ci, setCi] = useState(day.checkIn ?? '');
  const [co, setCo] = useState(day.checkOut ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setBusy(true);
    setErr('');
    try {
      await api('/api/attendance', {
        method: 'PUT',
        body: JSON.stringify({
          employeeId,
          date: day.date,
          status: day.status || 'present',
          checkIn: ci.trim() || null,
          checkOut: co.trim() || null,
        }),
      });
      setEditing(false);
      onSaved();
    } catch (e) {
      setErr((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <tr className="border-t border-line/60">
        <td className="py-1.5">{day.date}</td>
        <td className="py-1.5" colSpan={canEdit ? 5 : 4}>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              className="!w-24 !py-1"
              placeholder="HH:MM"
              value={ci}
              onChange={(e) => setCi(e.target.value)}
            />
            <span className="text-muted">→</span>
            <Input
              className="!w-24 !py-1"
              placeholder="HH:MM"
              value={co}
              onChange={(e) => setCo(e.target.value)}
            />
            <Button className="!py-1 !px-3" onClick={save} disabled={busy}>
              {busy ? '…' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              className="!py-1 !px-3"
              onClick={() => { setEditing(false); setCi(day.checkIn ?? ''); setCo(day.checkOut ?? ''); }}
            >
              Cancel
            </Button>
            <span className="text-muted">(24h, e.g. 11:00 and 20:30)</span>
            {err && <span className="text-danger">{err}</span>}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line/60">
      <td className="py-1.5">{day.date}</td>
      <td className="py-1.5">{day.checkIn ? to12h(day.checkIn) : '—'}</td>
      <td className="py-1.5">{day.checkOut ? to12h(day.checkOut) : '—'}</td>
      <td className="py-1.5">{day.worked != null ? fmtH(day.worked) : '—'}</td>
      <td className={`py-1.5 ${day.ot > 0 ? 'text-amber-300 font-semibold' : 'text-muted'}`}>
        {day.ot > 0 ? `+${fmtH(day.ot)}` : '—'}
      </td>
      {canEdit && (
        <td className="py-1.5">
          <Button variant="ghost" className="!py-1 !px-3" onClick={() => setEditing(true)}>Edit</Button>
        </td>
      )}
    </tr>
  );
}
