import { SectionCard, Table, Td, Th, Tr } from '../ui';

interface MonthTally { present: number; absent: number; pct: number }

export function MonthlyBreakdownTable({
  year, months, byMonth,
}: {
  year: number; months: string[]; byMonth: MonthTally[];
}) {
  return (
    <SectionCard className="mb-5" title={`Monthly breakdown · ${year}`} bodyClassName="!p-0">
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th align="right">Present</Th>
              <Th align="right">Absent</Th>
              <Th align="right">%</Th>
            </tr>
          </thead>
          <tbody>
            {byMonth.map((m, i) => (
              <Tr key={i}>
                <Td className="font-medium">{months[i]}</Td>
                <Td align="right" className="tabular-nums text-emerald-300 font-semibold">{m.present}</Td>
                <Td align="right" className="tabular-nums text-danger font-semibold">{m.absent}</Td>
                <Td align="right" className="tabular-nums">{m.present + m.absent > 0 ? `${m.pct}%` : '—'}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </SectionCard>
  );
}
