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
 */
export function buildYearMatrix(
  employees: Employee[],
  records: AttendanceRecord[],
  year: number,
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

    const row = byEmployee.get(r.employeeId);
    if (row) {
      add(row.months[monthIdx], r.status);
      add(row.totals, r.status);
    }
    add(companyByMonth[monthIdx], r.status);
    add(companyTotals, r.status);
  }

  return {
    year,
    employees: [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name)),
    companyByMonth,
    companyTotals,
  };
}
