import { store } from './store';
import { AttendanceStatus } from './types';
import importedRaw from './importedAttendance.json';

interface ImportedRecord {
  member: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}
interface ImportedData {
  members: string[];
  records: ImportedRecord[];
}

const imported = importedRaw as ImportedData;

/**
 * Load the bundled attendance dataset (imported from the company's spreadsheet)
 * into a company: one employee per team member, plus every daily record. Used
 * to preview historical data in the in-memory adapter. Idempotent per company:
 * it skips if the company already has employees.
 */
export function importAttendanceInto(
  companyId: string,
  opts: { force?: boolean } = {},
): { employees: number; records: number } {
  if (!opts.force) {
    const already = [...store.employees.values()].some((e) => e.companyId === companyId);
    if (already) return { employees: 0, records: 0 };
  }

  const now = store.now();
  const employeeIdByName = new Map<string, string>();

  for (const name of imported.members) {
    // Reuse an existing employee with the same name (e.g. one already synced
    // from Slack) instead of creating a duplicate.
    const existing = [...store.employees.values()].find(
      (e) => e.companyId === companyId && e.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      employeeIdByName.set(name, existing.id);
      continue;
    }
    const id = store.id();
    store.employees.set(id, {
      id,
      companyId,
      userId: null,
      shiftId: null,
      slackUserId: null,
      name,
      email: '',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: now,
    });
    employeeIdByName.set(name, id);
  }

  let records = 0;
  for (const r of imported.records) {
    const employeeId = employeeIdByName.get(r.member);
    if (!employeeId) continue;
    const id = store.id();
    store.attendanceRecords.set(id, {
      id,
      companyId,
      employeeId,
      date: r.date,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status as AttendanceStatus,
      createdAt: now,
      updatedAt: now,
    });
    records += 1;
  }

  return { employees: employeeIdByName.size, records };
}
