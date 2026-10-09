import { to12h } from '../../lib/ui';

export interface Employee {
  id: string;
  name: string;
  email: string;
  status: string;
  avatarUrl?: string | null;
  createdAt: string;
}
export const isActive = (e: Employee) => e.status === 'active';
export interface Record {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WD = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
// Saturdays are standard days off for everyone from this date onward (HR policy,
// Oct 2026). 2026-10-03 is the first such Saturday.
export const SATURDAY_OFF_FROM = '2026-10-03';

// Fixed widths so the frozen summary columns can be pinned precisely.
export const W = { name: 190, present: 74, absent: 74, pct: 60, day: 30 };
export const LEFT = {
  name: 0,
  present: W.name,
  absent: W.name + W.present,
  pct: W.name + W.present + W.absent,
};
export const SUMMARY_WIDTH = W.name + W.present + W.absent + W.pct;

export function pad(n: number) {
  return String(n).padStart(2, '0');
}
export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}
/** Logged hours between sign-in and sign-out (checkout ≤ checkin = overnight). */
export function loggedHours(checkIn: string, checkOut: string): number {
  const a = parseHM(checkIn);
  let b = parseHM(checkOut);
  if (b <= a) b += 24;
  return b - a;
}
export function fmtDur(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}
// Today's date in PKT (company timezone, UTC+5), for spotting still-open shifts.
export function pktToday(): string {
  return pktNow().date;
}
// Current PKT date and minutes-since-midnight, for precise overnight checks.
export function pktNow(): { date: string; minutes: number } {
  const d = new Date(Date.now() + 5 * 3600 * 1000);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
export function nextDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
/**
 * The real sign-out for a record, or null if the person hasn't signed out yet.
 * A sign-out earlier than the sign-in is an overnight shift whose end falls on
 * the NEXT day at that time, so it only counts once that exact moment has passed
 * in PKT. Until then the value is a not-yet-real / mis-paired sign-out and the
 * shift is still open (e.g. an Oct 6 shift ending ~2 AM Oct 7 shows no sign-out
 * until 2 AM Oct 7 arrives).
 */
export function effectiveCheckOut(date: string, checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return checkOut;
  const overnight = parseHM(checkOut) <= parseHM(checkIn);
  if (!overnight) return checkOut;
  const endDate = nextDate(date);
  const now = pktNow();
  if (endDate > now.date) return null;
  if (endDate === now.date && parseHM(checkOut) * 60 > now.minutes) return null;
  return checkOut;
}
/**
 * True when a record is a still-open shift today: the person has signed in but
 * not signed out yet. Attendance is only marked present after sign-out, so such
 * a day is shown as pending (not P) and doesn't count toward present. Past days
 * (shift already over) and manually-marked days (no sign-in at all) are never
 * pending — they count as present as before.
 */
export function pendingSignOut(date: string, rec: Record | undefined): boolean {
  if (!rec || !rec.checkIn) return false;
  if (date < pktToday()) return false;
  return !effectiveCheckOut(date, rec.checkIn, rec.checkOut);
}
/** Hover text for a cell: name, date, status, and logged hours from Slack. */
export function cellTitle(name: string, date: string, t: string, rec: Record | undefined, holidayName?: string): string {
  let line = `${name} · ${date}${t ? ` · ${t}` : ''}`;
  const checkOut = rec ? effectiveCheckOut(date, rec.checkIn, rec.checkOut) : null;
  if (rec?.checkIn && checkOut) {
    line += `\nSign in ${to12h(rec.checkIn)} → Sign out ${to12h(checkOut)} · Logged ${fmtDur(loggedHours(rec.checkIn, checkOut))}`;
  } else if (rec?.checkIn) {
    line += `\nSign in ${to12h(rec.checkIn)} · no sign-out yet`;
  } else if (checkOut) {
    line += `\nSign out ${to12h(checkOut)}`;
  }
  if (holidayName) line += `\nHoliday: ${holidayName}`;
  return line;
}
export function today() {
  return new Date().toISOString().slice(0, 10);
}
export function daysInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (d <= end) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function cellFor(date: string, rec: Record | undefined, holidayName?: string): { t: string; cls: string } {
  // Attendance history (P/A/leave/half-day) only exists from the employee's
  // joining day onward — but Off/holiday are calendar facts that apply to
  // everyone regardless of when they joined, so those still show below even
  // for a not-yet-joined row (a record can never predate joinDate, since
  // joinDate is derived as the earlier of the two — see the caller).
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  // Worked attendance always shows, even on a holiday or weekend — so anyone who
  // actually logged time on a declared holiday still gets their P. But present is
  // only marked after sign-out: a still-open shift today (signed in, no sign-out
  // yet) shows as pending, not P.
  if (rec && (rec.status === 'present' || rec.status === 'late')) {
    if (pendingSignOut(date, rec)) return { t: '•', cls: 'text-amber-300/70' };
    return { t: 'P', cls: 'bg-emerald-600/25 text-emerald-300' };
  }
  // Otherwise a declared company holiday marks the whole day off for everyone.
  // Show the holiday's own name (e.g. "Eid") rather than a generic "Off", so
  // named holidays are distinguishable in the grid — truncated to fit the
  // narrow day column; the full name is still in the hover tooltip.
  if (holidayName) {
    const label = holidayName.length > 3 ? holidayName.slice(0, 3) : holidayName;
    return { t: label, cls: 'text-muted/70' };
  }
  if (rec) {
    switch (rec.status) {
      case 'absent':
        return { t: 'A', cls: 'bg-red-600 text-white' };
      case 'leave':
        return { t: 'L', cls: 'bg-blue-700/40 text-blue-200' };
      case 'half_day':
        return { t: '½', cls: 'bg-amber-700/40 text-amber-200' };
      case 'holiday':
        return { t: 'Off', cls: 'text-muted/70' };
      case 'off_day':
        return { t: 'Off', cls: 'text-muted' };
    }
  }
  // Saturdays are standard company days off from 2026-10-03 onward (HR policy).
  // Anyone who still works an as-needed Saturday keeps their P from the record
  // block above; everyone else shows Off (past and future alike).
  if (wd === 6 && date >= SATURDAY_OFF_FROM) return { t: 'Off', cls: 'text-muted/70' };
  if (date > today()) return { t: '', cls: '' };
  if (wd === 0) return { t: 'Off', cls: 'text-muted/70' }; // Sunday
  return { t: '', cls: '' };
}
