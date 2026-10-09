import { AttendanceRecord, AttendanceStatus, Employee } from '../data/types';

export const STATUS_KEYS: AttendanceStatus[] = [
  'present',
  'late',
  'absent',
  'leave',
  'half_day',
  'off_day',
  'holiday',
];

export type StatusCounts = Record<AttendanceStatus, number> & { total: number };

function emptyCounts(): StatusCounts {
  const c = { total: 0 } as StatusCounts;
  for (const k of STATUS_KEYS) c[k] = 0;
  return c;
}

function add(counts: StatusCounts, status: AttendanceStatus): void {
  counts[status] += 1;
  counts.total += 1;
}

export interface EmployeeYearRow {
  employeeId: string;
  name: string;
  months: StatusCounts[]; // length 12, index 0 = January
  totals: StatusCounts;
}

export interface YearMatrix {
  year: number;
  employees: EmployeeYearRow[];
  companyByMonth: StatusCounts[]; // length 12
  companyTotals: StatusCounts;
}

/**
 * Aggregate a company's attendance records into a per-employee, per-month matrix
 * for one year. Pure and tenant-agnostic — callers pass already-scoped data.
 *
 * `holidayDates`, if given, mirrors the Attendance grid's own rule (see
 * cellFor in frontend/app/attendance/page.tsx): worked time (present/late)
 * always counts as itself, even on a declared holiday, but anything else
 * (absent/leave/half_day/off_day) on a holiday date is a day off, not an
 * absence — so it's tallied under 'holiday' instead of its literal status.
 * Without this, a holiday that falls where someone had an 'absent' record
 * inflates the Absent count here beyond what the grid shows.
 */
export function buildYearMatrix(
  employees: Employee[],
  records: AttendanceRecord[],
  year: number,
  holidayDates?: ReadonlySet<string>,
): YearMatrix {
  const byEmployee = new Map<string, EmployeeYearRow>();
  for (const e of employees) {
    byEmployee.set(e.id, {
      employeeId: e.id,
      name: e.name,
      months: Array.from({ length: 12 }, emptyCounts),
      totals: emptyCounts(),
    });
  }

  const companyByMonth = Array.from({ length: 12 }, emptyCounts);
  const companyTotals = emptyCounts();

  for (const r of records) {
    if (!r.date.startsWith(`${year}-`)) continue;
    const monthIdx = Number(r.date.slice(5, 7)) - 1; // "YYYY-MM-DD"
    if (monthIdx < 0 || monthIdx > 11) continue;

    const onHoliday = holidayDates?.has(r.date) ?? false;
    const status = onHoliday && r.status !== 'present' && r.status !== 'late' ? 'holiday' : r.status;

    const row = byEmployee.get(r.employeeId);
    if (row) {
      add(row.months[monthIdx], status);
      add(row.totals, status);
    }
    add(companyByMonth[monthIdx], status);
    add(companyTotals, status);
  }

  return {
    year,
    employees: [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name)),
    companyByMonth,
    companyTotals,
  };
}
