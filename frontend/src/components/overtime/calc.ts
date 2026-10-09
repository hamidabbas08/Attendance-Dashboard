export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface Employee {
  id: string;
  name: string;
  status: string;
  avatarUrl?: string | null;
  shiftId?: string | null;
}
export interface ShiftRec extends Shift {
  id: string;
}
export interface Record {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
}
export interface Shift {
  name: string;
  startTime: string;
  endTime: string;
  graceMins: number;
}

// Default standard shift length (hours) when an employee has no shift assigned:
// 9h from 2026-10-05 (8 work + 1 break), 12h before. Per the HR policy (Oct 2026).
const NEW_SHIFT_FROM = '2026-10-05';
export function defaultShiftHours(date: string): number {
  return date >= NEW_SHIFT_FROM ? 9 : 12;
}

// Overtime is only applied from this date onward; earlier days show worked hours
// but never accrue overtime.
const OVERTIME_FROM = '2026-10-05';

export function pad(n: number) {
  return String(n).padStart(2, '0');
}
export function parseHM(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h + (m || 0) / 60;
}
/** Hours between check-in and check-out, treating checkout ≤ checkin as overnight. */
export function elapsedHours(checkIn: string, checkOut: string): number {
  const a = parseHM(checkIn);
  let b = parseHM(checkOut);
  if (b <= a) b += 24;
  return b - a;
}
/** Length of an assigned shift in hours (overnight-aware), or null if none. */
export function shiftLength(shift?: Shift | null): number | null {
  if (!shift) return null;
  const a = parseHM(shift.startTime);
  let b = parseHM(shift.endTime);
  if (b <= a) b += 24;
  return b - a;
}
// Overtime = time worked beyond the shift, counted only once the person has
// signed out (both check-in and check-out present) and from the cutoff onward.
export function overtimeOf(date: string, checkIn: string | null, checkOut: string | null, shiftHrs: number): number {
  if (!checkIn || !checkOut) return 0; // shift not ended yet → no overtime
  if (date < OVERTIME_FROM) return 0;
  return Math.max(0, elapsedHours(checkIn, checkOut) - shiftHrs);
}
export function fmtH(h: number): string {
  if (h <= 0) return '—';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
}

export interface DayRow {
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  worked: number | null;
  ot: number;
}

// Current PKT (company timezone, UTC+5) date and minutes-since-midnight.
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
 * A sign-out earlier than the sign-in is an overnight shift whose end actually
 * falls on the NEXT day at that time — so it only counts once that exact moment
 * has passed in PKT. Until then the value is not-yet-real / mis-paired and the
 * shift is still open (e.g. an Oct 6 shift ending ~2 AM Oct 7 shows no sign-out
 * and no overtime until 2 AM Oct 7 arrives).
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
 * Per-day worked/overtime for one person's records, plus totals. `shiftHrs` is
 * the person's assigned shift length (hours); when null, a day's standard length
 * is used as a fallback. Overtime and worked hours count only after sign-out.
 */
export function computeDays(recs: Record[], shiftHrs: number | null) {
  let totalOt = 0;
  let totalWorked = 0;
  let daysWithTimes = 0;
  const days: DayRow[] = recs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const checkOut = effectiveCheckOut(r.date, r.checkIn, r.checkOut);
      const worked = r.checkIn && checkOut ? elapsedHours(r.checkIn, checkOut) : null;
      const ot = overtimeOf(r.date, r.checkIn, checkOut, shiftHrs ?? defaultShiftHours(r.date));
      if (worked != null) {
        totalWorked += worked;
        totalOt += ot;
        daysWithTimes += 1;
      }
      return { date: r.date, status: r.status, checkIn: r.checkIn, checkOut, worked, ot };
    });
  return { days, totalOt, totalWorked, daysWithTimes };
}

export function rangeFor(year: number, month: number | 'all') {
  const from = month === 'all' ? `${year}-01-01` : `${year}-${pad(month + 1)}-01`;
  const to =
    month === 'all'
      ? `${year}-12-31`
      : `${year}-${pad(month + 1)}-${pad(new Date(Date.UTC(year, month + 1, 0)).getUTCDate())}`;
  return { from, to };
}
