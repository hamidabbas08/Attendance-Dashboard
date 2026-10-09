import { buildYearMatrix } from '../src/attendance/summary';
import { AttendanceRecord, Employee } from '../src/data/types';

function emp(id: string, name: string): Employee {
  return {
    id, companyId: 'A', userId: null, shiftId: null, slackUserId: null,
    name, email: `${id}@a.test`, avatarUrl: null, roles: ['employee'], role: 'employee', status: 'active', terminatedAt: null, createdAt: '', updatedAt: '',
  };
}
function rec(employeeId: string, date: string, status: AttendanceRecord['status']): AttendanceRecord {
  return {
    id: `${employeeId}-${date}`, companyId: 'A', employeeId, date,
    checkIn: null, checkOut: null, status, createdAt: '', updatedAt: '',
  };
}

describe('buildYearMatrix', () => {
  const employees = [emp('e1', 'Alice'), emp('e2', 'Bob')];
  const records = [
    rec('e1', '2026-01-05', 'present'),
    rec('e1', '2026-01-06', 'late'),
    rec('e1', '2026-03-10', 'absent'),
    rec('e2', '2026-01-05', 'present'),
    rec('e2', '2025-12-31', 'late'), // different year — must be ignored
  ];

  it('aggregates per employee per month', () => {
    const m = buildYearMatrix(employees, records, 2026);
    const alice = m.employees.find((e) => e.name === 'Alice')!;
    expect(alice.months[0].present).toBe(1); // Jan
    expect(alice.months[0].late).toBe(1);
    expect(alice.months[0].total).toBe(2);
    expect(alice.months[2].absent).toBe(1); // Mar
    expect(alice.totals.total).toBe(3);
  });

  it('excludes records from other years', () => {
    const m = buildYearMatrix(employees, records, 2026);
    const bob = m.employees.find((e) => e.name === 'Bob')!;
    expect(bob.totals.total).toBe(1); // only the Jan present, not the 2025 late
  });

  it('computes company-wide monthly totals', () => {
    const m = buildYearMatrix(employees, records, 2026);
    expect(m.companyByMonth[0].total).toBe(3); // Jan: Alice 2 + Bob 1
    expect(m.companyTotals.total).toBe(4);
  });

  it('sorts employees by name and includes those with no records', () => {
    const m = buildYearMatrix([emp('e3', 'Zoe'), ...employees], [], 2026);
    expect(m.employees.map((e) => e.name)).toEqual(['Alice', 'Bob', 'Zoe']);
    expect(m.employees[2].totals.total).toBe(0);
  });

  it('reclassifies a non-worked record on a declared holiday as "holiday", not its literal status', () => {
    // Mirrors the Attendance grid's own rule (cellFor): an absence/leave/etc.
    // that lands on a company holiday is a day off, not an absence — but
    // worked time (present/late) still counts as itself even on a holiday.
    const withHoliday = [
      ...records,
      rec('e1', '2026-03-12', 'present'), // worked ON a holiday — still present
    ];
    const holidayDates = new Set(['2026-03-10', '2026-03-12']);
    const m = buildYearMatrix(employees, withHoliday, 2026, holidayDates);
    const alice = m.employees.find((e) => e.name === 'Alice')!;
    expect(alice.months[2].absent).toBe(0); // the Mar 10 absence is now a holiday
    expect(alice.months[2].holiday).toBe(1);
    expect(alice.months[2].present).toBe(1); // Mar 12 — worked, unaffected
  });
});
