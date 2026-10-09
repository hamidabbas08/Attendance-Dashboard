import { Select } from '../ui';
import { MONTHS } from './calc';

/** Year + month selector shared by both Overtime views. */
export function PeriodControls({
  year, setYear, month, setMonth, curYear,
}: {
  year: number; setYear: (y: number) => void;
  month: number | 'all'; setMonth: (m: number | 'all') => void; curYear: number;
}) {
  return (
    <div className="flex items-end gap-3">
      <Select
        label="Year"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        options={[curYear - 1, curYear, curYear + 1].map((y) => ({ value: y, label: y }))}
      />
      <Select
        label="Month"
        value={month}
        onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        options={[{ value: 'all', label: 'Full year' }, ...MONTHS.map((m, i) => ({ value: i, label: m }))]}
      />
    </div>
  );
}
