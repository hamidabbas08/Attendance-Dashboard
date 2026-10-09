import Link from 'next/link';
import { EmptyState, SectionCard, Table, Td, Th, Tr } from '../ui';
import { attended, EmpRow, rate } from './metrics';

export function TopAbsencesTable({ year, rows }: { year: number; rows: EmpRow[] }) {
  return (
    <SectionCard
      className="mb-5"
      title={`Most absences · ${year}`}
      actions={<Link href="/reports" className="text-sm font-medium hover:underline">View full report →</Link>}
      bodyClassName="!p-0"
    >
      {rows.length === 0 ? (
        <EmptyState title="No absences recorded" description={`Nobody has been marked absent in ${year}. Attendance fills in as people check in and out.`} />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th align="right">Present</Th>
                <Th align="right">Absent</Th>
                <Th align="right">Rate</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <Tr key={e.employeeId}>
                  <Td className="font-medium">
                    <Link href={`/employee/${e.employeeId}`} className="hover:text-accent transition-colors duration-150">
                      {e.name}
                    </Link>
                  </Td>
                  <Td align="right" className="tabular-nums text-emerald-300 font-semibold">{attended(e.totals)}</Td>
                  <Td align="right" className="tabular-nums text-red-300 font-semibold">{e.totals.absent}</Td>
                  <Td align="right" className="tabular-nums">{rate(e.totals) ?? 0}%</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}
