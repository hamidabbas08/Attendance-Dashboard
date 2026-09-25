import { computeStatus, isoWeekday, toMinutes } from '../src/attendance/attendanceEngine';
import { AttendanceRule, Shift } from '../src/data/types';

const shift: Shift = {
  id: 's', companyId: 'A', name: 'Day', startTime: '09:00', endTime: '18:00',
  graceMins: 15, createdAt: '', updatedAt: '',
};
const rule: AttendanceRule = {
  id: 'r', companyId: 'A', workingDays: [1, 2, 3, 4, 5], defaultShiftId: 's',
  holidays: ['2026-12-25'], statuses: [], createdAt: '', updatedAt: '',
};

describe('attendance engine', () => {
  it('parses time and weekday', () => {
    expect(toMinutes('09:30')).toBe(570);
    expect(isoWeekday('2026-09-21')).toBe(1); // Monday
    expect(isoWeekday('2026-09-20')).toBe(7); // Sunday
  });

  it('marks off_day on a non-working day', () => {
    expect(computeStatus({ date: '2026-09-20', checkIn: '09:00', checkOut: null, shift, rule }))
      .toBe('off_day');
  });

  it('marks holiday from company config', () => {
    expect(computeStatus({ date: '2026-12-25', checkIn: '09:00', checkOut: null, shift, rule }))
      .toBe('holiday');
  });

  it('marks absent with no check-in on a working day', () => {
    expect(computeStatus({ date: '2026-09-21', checkIn: null, checkOut: null, shift, rule }))
      .toBe('absent');
  });

  it('respects the grace period for present vs late', () => {
    expect(computeStatus({ date: '2026-09-21', checkIn: '09:14', checkOut: '18:00', shift, rule }))
      .toBe('present');
    expect(computeStatus({ date: '2026-09-21', checkIn: '09:16', checkOut: '18:00', shift, rule }))
      .toBe('late');
  });

  it('uses the EMPLOYEE shift — a later shift is not late at 09:40', () => {
    const lateShift: Shift = { ...shift, startTime: '10:00' };
    expect(computeStatus({ date: '2026-09-21', checkIn: '09:40', checkOut: '19:00', shift: lateShift, rule }))
      .toBe('present');
  });

  it('marks half day when less than half the shift is worked', () => {
    expect(computeStatus({ date: '2026-09-21', checkIn: '09:00', checkOut: '12:00', shift, rule }))
      .toBe('half_day');
  });

  it('honours an explicit override (e.g. approved leave)', () => {
    expect(computeStatus({ date: '2026-09-21', checkIn: null, checkOut: null, shift, rule, override: 'leave' }))
      .toBe('leave');
  });
});
