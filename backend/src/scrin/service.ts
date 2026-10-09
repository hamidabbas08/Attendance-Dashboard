import { config } from '../config/env';
import { getActivities, getCommonData, getScreenshots, ScrinActivity, ScrinScreenshot } from './client';

export const scrinEnabled = Boolean(config.scrinApiKey);

// The company/employment list changes rarely — cache it instead of calling
// GetCommonData on every request. Keyed by nothing (one token = one account).
interface EmploymentInfo {
  id: number;
  lastActive: number | null; // epoch seconds
}
let employmentCache: { byEmail: Map<string, EmploymentInfo>; weekStartDay: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function employmentsByEmail(): Promise<{ byEmail: Map<string, EmploymentInfo>; weekStartDay: number }> {
  const fresh = employmentCache && Date.now() - employmentCache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return employmentCache!;

  const byEmail = new Map<string, EmploymentInfo>();
  let weekStartDay = 1; // Monday — scrin.io's own default, confirmed from a real company response.
  const companies = await getCommonData(config.scrinApiKey);
  for (const company of companies) {
    if (typeof company.config?.weekStartDay === 'number') weekStartDay = company.config.weekStartDay;
    for (const emp of company.employments) {
      if (emp.email) byEmail.set(emp.email.toLowerCase(), { id: emp.id, lastActive: emp.lastActive ?? null });
    }
  }
  employmentCache = { byEmail, weekStartDay, fetchedAt: Date.now() };
  return employmentCache;
}

/** The scrin.io employment id linked to this email, or null if none. */
export async function findEmploymentId(email: string): Promise<number | null> {
  if (!scrinEnabled || !email) return null;
  const { byEmail } = await employmentsByEmail();
  return byEmail.get(email.toLowerCase())?.id ?? null;
}

// Mirrors the Slack TZ handling (backend/src/slack/eventHandler.ts): a local
// calendar day's UTC epoch-second boundaries, shifted by the same configured
// offset (default PKT, UTC+5) so "today" means the same thing across the app.
const TZ_OFFSET_MS = config.attendanceTzOffsetMinutes * 60 * 1000;
function localDayRangeSeconds(date: string): { from: number; to: number } {
  const utcMidnight = Date.parse(`${date}T00:00:00.000Z`);
  const localMidnightUtcMs = utcMidnight - TZ_OFFSET_MS;
  return {
    from: Math.floor(localMidnightUtcMs / 1000),
    to: Math.floor((localMidnightUtcMs + 24 * 60 * 60 * 1000) / 1000),
  };
}
function todayLocalStr(): string {
  return new Date(Date.now() + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
function shiftDateStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** The Monday-or-whatever-weekStartDay on/before `date` (0=Sun..6=Sat). */
function startOfWeekStr(date: string, weekStartDay: number): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDateStr(date, -((dow - weekStartDay + 7) % 7));
}
function startOfMonthStr(date: string): string {
  return `${date.slice(0, 7)}-01`;
}
function daysInMonthStr(month: string): number {
  // month = "YYYY-MM". Day 0 of the next month = last day of this one.
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// The rest of the app always shows local "HH:mm" strings (see AttendanceRecord
// checkIn/checkOut), never raw epoch — scrin.io's API returns epoch seconds,
// so convert here rather than pushing a timezone assumption onto the frontend.
function localHHMM(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000 + TZ_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

function overlapSeconds(activities: ScrinActivity[], from: number, to: number): number {
  return activities.reduce((sum, a) => sum + Math.max(0, Math.min(a.to, to) - Math.max(a.from, from)), 0);
}

export interface Overview {
  linked: boolean;
  lastActive: number | null; // epoch seconds
  todaySeconds: number;
  yesterdaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  activeDays: string[]; // "YYYY-MM-DD" days in `month` (up to today) with any tracked time
}

/**
 * Today / yesterday / this-week / this-month totals, plus which days in the
 * given month have any activity (for a day-picker strip) — one GetActivities
 * call covering everything needed, mirroring scrin.io's own "My Home" /
 * employee dashboard view.
 */
export async function getOverview(email: string, month?: string): Promise<Overview> {
  const empty: Overview = {
    linked: false, lastActive: null, todaySeconds: 0, yesterdaySeconds: 0, weekSeconds: 0, monthSeconds: 0, activeDays: [],
  };
  const { byEmail, weekStartDay } = await employmentsByEmail();
  const info = byEmail.get(email.toLowerCase());
  if (!info) return empty;

  const today = todayLocalStr();
  const yesterday = shiftDateStr(today, -1);
  const week = startOfWeekStr(today, weekStartDay);
  const reqMonth = month ?? today.slice(0, 7);
  const monthStart = startOfMonthStr(reqMonth);
  // The earliest boundary we need data for. "Yesterday" can fall in the
  // previous month (e.g. today is the 1st), so the fetch window covers it.
  const fetchFromDate = [monthStart, week, yesterday].sort()[0];
  const todayRange = localDayRangeSeconds(today);
  const fetchFrom = localDayRangeSeconds(fetchFromDate).from;

  const activities = await getActivities(config.scrinApiKey, [{ employmentId: info.id, from: fetchFrom, to: todayRange.to }]);

  const yesterdayRange = localDayRangeSeconds(yesterday);
  const weekRange = { from: localDayRangeSeconds(week).from, to: todayRange.to };
  const monthRange = { from: localDayRangeSeconds(monthStart).from, to: todayRange.to };

  const lastDay = Math.min(daysInMonthStr(reqMonth), reqMonth === today.slice(0, 7) ? Number(today.slice(8, 10)) : daysInMonthStr(reqMonth));
  const activeDays: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${reqMonth}-${String(d).padStart(2, '0')}`;
    const { from, to } = localDayRangeSeconds(date);
    if (overlapSeconds(activities, from, to) > 0) activeDays.push(date);
  }

  return {
    linked: true,
    lastActive: info.lastActive,
    todaySeconds: overlapSeconds(activities, todayRange.from, todayRange.to),
    yesterdaySeconds: overlapSeconds(activities, yesterdayRange.from, yesterdayRange.to),
    weekSeconds: overlapSeconds(activities, weekRange.from, weekRange.to),
    monthSeconds: overlapSeconds(activities, monthRange.from, monthRange.to),
    activeDays,
  };
}

export interface DayScreenshot extends ScrinScreenshot {
  takenLocal: string; // "HH:mm"
}
// A visual group of one or more consecutive same-note activities, the way
// scrin.io's own "Tasks" view presents them — a time-range header plus that
// span's screenshots, rather than one flat list.
export interface ActivityBlock {
  note: string | null;
  offline: boolean;
  from: number;
  to: number;
  fromLocal: string;
  toLocal: string;
  screenshots: DayScreenshot[];
}
export interface DayActivity {
  linked: boolean;
  totalSeconds: number;
  blocks: ActivityBlock[];
}

/** One employee's tracked activity + screenshots for one local calendar day. */
export async function getDayActivity(email: string, date: string): Promise<DayActivity> {
  const employmentId = await findEmploymentId(email);
  if (!employmentId) return { linked: false, totalSeconds: 0, blocks: [] };

  const { from, to } = localDayRangeSeconds(date);
  const activities = await getActivities(config.scrinApiKey, [{ employmentId, from, to }]);
  activities.sort((a, b) => a.from - b.from);
  const totalSeconds = activities.reduce((sum, a) => sum + Math.max(0, a.to - a.from), 0);

  const screenshots = await getScreenshots(config.scrinApiKey, activities.map((a) => a.id));
  const screenshotsByActivity = new Map<string, DayScreenshot[]>();
  for (const s of screenshots) {
    const withLocal = { ...s, takenLocal: localHHMM(s.taken) };
    const list = screenshotsByActivity.get(s.activityId) ?? [];
    list.push(withLocal);
    screenshotsByActivity.set(s.activityId, list);
  }

  // Merge consecutive same-note activities into one block (matches scrin.io's
  // own grouping — a "task" block can span several raw activity records).
  const blocks: ActivityBlock[] = [];
  for (const a of activities) {
    const shots = (screenshotsByActivity.get(a.id) ?? []).sort((x, y) => x.taken - y.taken);
    const last = blocks[blocks.length - 1];
    if (last && last.note === a.note && last.offline === a.offline) {
      last.to = a.to;
      last.toLocal = localHHMM(a.to);
      last.screenshots.push(...shots);
    } else {
      blocks.push({ note: a.note, offline: a.offline, from: a.from, to: a.to, fromLocal: localHHMM(a.from), toLocal: localHHMM(a.to), screenshots: shots });
    }
  }

  return { linked: true, totalSeconds, blocks };
}
