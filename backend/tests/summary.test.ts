import { buildYearMatrix } from '../src/attendance/summary';
import { AttendanceRecord, Employee } from '../src/data/types';

function emp(id: string, name: string): Employee {
  return {
    id, companyId: 'A', userId: null, shiftId: null, slackUserId: null,
    name, email: `${id}@a.test`, status: 'active', createdAt: '', updatedAt: '',
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
});
