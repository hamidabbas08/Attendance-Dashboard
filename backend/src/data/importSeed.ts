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
 * The company's two working shifts (HR policy, Oct 2026):
 *   Day   Shift — 11:00 AM – 8:00 PM  (11:00 → 20:00)
 *   Night Shift —  5:00 PM – 2:00 AM  (17:00 → 02:00, crosses midnight)
 * Ensures both exist for a company and returns their ids. Idempotent: it reuses
 * any shift already present with the same name instead of duplicating.
 */
export function ensureCompanyShifts(companyId: string): { dayShiftId: string; nightShiftId: string } {
  const now = store.now();
  const existing = [...store.shifts.values()].filter((s) => s.companyId === companyId);
  const find = (name: string) => existing.find((s) => s.name.toLowerCase() === name.toLowerCase());

  function ensure(name: string, startTime: string, endTime: string): string {
    const hit = find(name);
    // Only ever CREATE a missing shift — never overwrite an existing one's times.
    // HR/owners edit shift hours in the app, and this runs on every login/sync;
    // resetting the times here would silently revert their changes.
    if (hit) return hit.id;
    const id = store.id();
    store.shifts.set(id, {
      id,
      companyId,
      name,
      startTime,
      endTime,
      graceMins: 15,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  const dayShiftId = ensure('Day Shift', '11:00', '20:00');
  const nightShiftId = ensure('Night Shift', '17:00', '02:00');
  return { dayShiftId, nightShiftId };
}

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
  // Make sure the two standard shifts exist; default everyone to the Day Shift.
  const { dayShiftId } = ensureCompanyShifts(companyId);
  const employeeIdByName = new Map<string, string>();
  // People who have left the team: keep their history, but mark inactive so the
  // Team list and future attendance stop showing them.
  const FORMER_MEMBERS = new Set(['wania khan', 'syed jawad ali shah']);

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
      shiftId: dayShiftId,
      slackUserId: null,
      name,
      email: '',
      avatarUrl: null,
      roles: ['employee'],
      role: 'employee',
      status: FORMER_MEMBERS.has(name.toLowerCase()) ? 'inactive' : 'active',
      terminatedAt: null,
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
