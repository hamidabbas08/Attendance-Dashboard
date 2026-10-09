import Link from 'next/link';
import { Avatar, Table, Td, Th, Tr } from '../ui';
import { EmpRow } from '../dashboard/metrics';
import { attended, rate } from './metrics';

export function ReportsTable({
  rows, avatarById, year,
}: {
  rows: EmpRow[]; avatarById: Map<string, string | null>; year: number;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <thead>
          <tr>
            <Th>Employee</Th>
            <Th align="right">Present</Th>
            <Th align="right">Late</Th>
            <Th align="right">Absent</Th>
            <Th align="right">Leave</Th>
            <Th align="right">Rate</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <Tr key={e.employeeId}>
              <Td className="whitespace-nowrap">
                <div className="flex items-center gap-2.5">
                  <Avatar src={avatarById.get(e.employeeId)} name={e.name} size={30} />
                  <Link href={`/employee/${e.employeeId}`} className="font-medium hover:text-accent transition-colors duration-150">
                    {e.name}
                  </Link>
                </div>
              </Td>
              <Td align="right" className="tabular-nums text-emerald-300 font-semibold">{attended(e.totals)}</Td>
              <Td align="right" className="tabular-nums text-amber-300">{e.totals.late}</Td>
              <Td align="right" className="tabular-nums text-red-300 font-semibold">{e.totals.absent}</Td>
              <Td align="right" className="tabular-nums text-blue-300">{e.totals.leave}</Td>
              <Td align="right">
                <RateBadge value={rate(e.totals)} />
              </Td>
            </Tr>
          ))}
          {rows.length === 0 && (
            <tr><Td className="text-muted text-center py-8" colSpan={6}>No data for {year}.</Td></tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}

function RateBadge({ value }: { value: number }) {
  const tone = value >= 90 ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20'
    : value >= 75 ? 'bg-amber-500/15 text-amber-300 ring-amber-400/20'
    : 'bg-red-500/15 text-red-300 ring-red-400/20';
  const dot = value >= 90 ? 'bg-emerald-400' : value >= 75 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ring-1 ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {value}%
    </span>
  );
}
