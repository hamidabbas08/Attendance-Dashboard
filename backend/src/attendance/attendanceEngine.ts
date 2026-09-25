import { AttendanceRule, AttendanceStatus, Shift } from '../data/types';

/** Parse "HH:MM" into minutes since midnight. */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** ISO weekday (1 = Monday ... 7 = Sunday) for a "YYYY-MM-DD" date. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return day === 0 ? 7 : day;
}

export interface StatusInput {
  date: string;
  checkIn: string | null; // "HH:MM"
  checkOut: string | null;
  shift: Shift | null;
  rule: AttendanceRule;
  /** Explicit override, e.g. approved leave. Wins over computed status. */
  override?: AttendanceStatus;
}

/**
 * Compute an attendance status from the EMPLOYEE'S assigned shift and the
 * COMPANY'S configurable rules. Nothing here is hard-coded: working days,
 * holidays and shift timings all come from configuration.
 */
export function computeStatus(input: StatusInput): AttendanceStatus {
  if (input.override) return input.override;

  const { date, checkIn, checkOut, shift, rule } = input;

  if (rule.holidays.includes(date)) return 'holiday';
  if (!rule.workingDays.includes(isoWeekday(date))) return 'off_day';

  if (!checkIn) return 'absent';

  // No shift configured → present if they checked in at all.
  if (!shift) return 'present';

  const start = toMinutes(shift.startTime);
  const grace = shift.graceMins ?? 0;
  const arrival = toMinutes(checkIn);

  // Worked less than half the shift → half day.
  if (checkOut) {
    const worked = toMinutes(checkOut) - arrival;
    const shiftLength = toMinutes(shift.endTime) - start;
    if (shiftLength > 0 && worked > 0 && worked < shiftLength / 2) {
      return 'half_day';
    }
  }

  if (arrival > start + grace) return 'late';
  return 'present';
}
