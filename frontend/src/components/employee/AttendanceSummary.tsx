import { StatTile } from '../ui';
import { ui } from '../../lib/ui';
import { MonthlyBreakdownTable } from '../my-attendance/MonthlyBreakdownTable';
import { RecordsTable } from '../my-attendance/RecordsTable';

interface Rec { id: string; date: string; checkIn: string | null; checkOut: string | null; status: string }
interface Tally { present: number; absent: number; leave: number; pct: number }
interface MonthTally { present: number; absent: number; pct: number }

export function AttendanceSummary({
  year, months, yearly, byMonth, yearRecords, holidaySet,
}: {
  year: number;
  months: string[];
  yearly: Tally;
  byMonth: MonthTally[];
  yearRecords: Rec[];
  holidaySet: Set<string>;
}) {
  return (
    <>
      <div className={`${ui.grid} mb-5`}>
        <StatTile label={`Present in ${year}`} value={yearly.present} accent="#34d399" />
        <StatTile label={`Absent in ${year}`} value={yearly.absent} accent="#f87171" />
        <StatTile label="On leave" value={yearly.leave} accent="#38bdf8" />
        <StatTile label="Attendance %" value={`${yearly.pct}%`} accent="#a78bfa" />
      </div>
      <MonthlyBreakdownTable year={year} months={months} byMonth={byMonth} />
      <RecordsTable year={year} records={yearRecords} holidaySet={holidaySet} />
    </>
  );
}
