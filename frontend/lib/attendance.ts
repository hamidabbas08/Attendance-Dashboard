// Shared attendance-counting rules, so every view (team grid, My Attendance,
// My Profile, employee profile) agrees on what counts as present/absent.
//
// Rules (same as the team Attendance grid):
//  - present/late counts as present — but a still-open shift *today* (signed in,
//    no sign-out yet) is pending and is NOT counted until the person signs out;
//  - an absence on a declared company holiday does NOT count (whole day off);
//  - leave is tallied separately.

export interface AttendanceRec {
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
}

function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}

// Today's date in PKT (company timezone, UTC+5), for spotting still-open shifts.
export function pktToday(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * The real sign-out for a record, or null if the person hasn't signed out yet.
 * An overnight sign-out (≤ sign-in) can only complete once the next day arrives,
 * so on today's date such a value is a mis-paired carry-over and the shift is
 * still open.
 */
export function effectiveCheckOut(date: string, checkIn?: string | null, checkOut?: string | null): string | null {
  if (!checkIn || !checkOut) return checkOut ?? null;
  const overnight = parseHM(checkOut) <= parseHM(checkIn);
  if (overnight && date >= pktToday()) return null;
  return checkOut;
}

/**
 * True when a record is a still-open shift today: signed in but not signed out
 * yet. Past days (shift over) and manually-marked days (no sign-in) are never
 * pending, so historical present-days are unaffected.
 */
export function pendingSignOut(rec: AttendanceRec): boolean {
  if (!rec.checkIn) return false;
  if (rec.date < pktToday()) return false;
  return !effectiveCheckOut(rec.date, rec.checkIn, rec.checkOut);
}

/**
 * The status to show for a record in a records table. A worked day (present/late)
 * always shows as worked, even on a holiday; otherwise a declared holiday shows
 * as "holiday" so HR-declared days off are reflected in the employee's view.
 */
export function displayStatus(rec: AttendanceRec, holidays?: Set<string>): string {
  if (rec.status === 'present' || rec.status === 'late') return rec.status;
  if (holidays?.has(rec.date)) return 'holiday';
  return rec.status;
}

/**
 * Tally present/absent/leave for a set of records, honouring declared holidays
 * (a Set of "YYYY-MM-DD" dates) and the pending-sign-out rule.
 */
export function tally(records: AttendanceRec[], holidays?: Set<string>) {
  let present = 0;
  let absent = 0;
  let leave = 0;
  for (const r of records) {
    if ((r.status === 'present' || r.status === 'late') && !pendingSignOut(r)) present += 1;
    else if (r.status === 'absent' && !(holidays?.has(r.date))) absent += 1;
    else if (r.status === 'leave') leave += 1;
  }
  const pct = present + absent > 0 ? Math.round((present / (present + absent)) * 100) : 0;
  return { present, absent, leave, pct };
}
