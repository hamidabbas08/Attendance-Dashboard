import { SectionCard, StatusPill, Table, Td, Th, Tr } from '../ui';
import { displayStatus } from '../../lib/attendance';
import { to12h } from '../../lib/ui';

interface Record {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

export function RecordsTable({
  year, records, holidaySet,
}: {
  year: number; records: Record[]; holidaySet: Set<string>;
}) {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <SectionCard title={`Records · ${year}`} subtitle={`${records.length} days`} bodyClassName="!p-0">
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Check in</Th>
              <Th>Check out</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium tabular-nums">{r.date}</Td>
                <Td className="tabular-nums">{r.checkIn ? to12h(r.checkIn) : '—'}</Td>
                <Td className="tabular-nums">{r.checkOut ? to12h(r.checkOut) : '—'}</Td>
                <Td><StatusPill status={displayStatus(r, holidaySet)} /></Td>
              </Tr>
            ))}
            {records.length === 0 && (
              <tr>
                <Td className="text-muted text-center py-8" colSpan={4}>No attendance records for {year}.</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </SectionCard>
  );
}
