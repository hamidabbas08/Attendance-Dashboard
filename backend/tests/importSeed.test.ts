import { importAttendanceInto } from '../src/data/importSeed';
import { store } from '../src/data/store';

beforeEach(() => store.reset());

describe('importAttendanceInto', () => {
  it('loads the bundled spreadsheet dataset into a company', () => {
    const res = importAttendanceInto('company-x');
    expect(res.employees).toBe(10);
    expect(res.records).toBeGreaterThan(1300);

    const emps = [...store.employees.values()].filter((e) => e.companyId === 'company-x');
    expect(emps.length).toBe(10);
    const recs = [...store.attendanceRecords.values()].filter((r) => r.companyId === 'company-x');
    expect(recs.length).toBe(res.records);
    // Every record is tenant-scoped and has a valid status.
    for (const r of recs) {
      expect(r.companyId).toBe('company-x');
      expect(['present', 'late', 'absent', 'leave', 'half_day', 'off_day', 'holiday']).toContain(r.status);
    }
  });

  it('is idempotent — a second call adds nothing', () => {
    importAttendanceInto('company-y');
    const res2 = importAttendanceInto('company-y');
    expect(res2.employees).toBe(0);
    expect(res2.records).toBe(0);
  });

  it('keeps imports isolated per company', () => {
    importAttendanceInto('A');
    importAttendanceInto('B');
    const a = [...store.attendanceRecords.values()].filter((r) => r.companyId === 'A').length;
    const b = [...store.attendanceRecords.values()].filter((r) => r.companyId === 'B').length;
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(1300);
  });
});
