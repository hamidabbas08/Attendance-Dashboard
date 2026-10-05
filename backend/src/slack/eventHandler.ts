import { botTokenForWorkspace } from '../auth/slackOAuth';
import { computeStatus } from '../attendance/attendanceEngine';
import { TenantRepository } from '../data/repository';
import { store } from '../data/store';
import { Employee, SlackWorkspace } from '../data/types';
import { NotFoundError } from '../errors';
import { fetchSlackUser } from './api';

export interface SlackEvent {
  team_id: string;
  event: {
    type: string;
    subtype?: string;
    bot_id?: string;
    user: string; // slack user id
    text: string;
    ts: string; // epoch seconds as string
    channel?: string;
  };
}

export interface ProcessResult {
  companyId: string;
  employeeId: string | null;
  status: string | null;
  action: 'recorded' | 'ignored_no_employee' | 'ignored_no_intent' | 'ignored_bot' | 'ignored_terminated';
}

/** "in"/"sign in" → check_in, "out"/"sign out" → check_out, else null. */
export function classifyIntent(text: string): 'check_in' | 'check_out' | null {
  const t = text.toLowerCase();
  if (/\b(sign\s?in|check(?:ing|-)?\s?in|checkin|clock\s?in|\bin\b|start)\b/.test(t)) return 'check_in';
  if (/\b(sign\s?out|check(?:ing|-)?\s?out|checkout|clock\s?out|\bout\b|leaving|done)\b/.test(t)) {
    return 'check_out';
  }
  return null;
}

function hhmmFromTs(ts: string): string {
  const d = new Date(Number(ts) * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
function dateFromTs(ts: string): string {
  return new Date(Number(ts) * 1000).toISOString().slice(0, 10);
}

/**
 * Resolve the employee for a Slack user, healing the mapping on the fly:
 *   1. an employee already linked to this Slack user id, else
 *   2. look up the user's Slack profile and link an existing employee by name/
 *      email (sets their slack id), else
 *   3. auto-create a new employee for this workspace member.
 * So attendance records even if "Sync from Slack" was never run.
 */
async function resolveEmployee(
  repo: TenantRepository,
  companyId: string,
  botToken: string,
  slackUserId: string,
): Promise<Employee | null> {
  const direct = repo.findEmployeeBySlackUser(companyId, slackUserId);
  if (direct) return direct;

  const profile =
    botToken && process.env.NODE_ENV !== 'test' ? await fetchSlackUser(botToken, slackUserId) : null;
  const roster = repo.listEmployees();

  const match =
    (profile?.name
      ? roster.find((e) => !e.slackUserId && e.name.toLowerCase() === profile.name!.toLowerCase())
      : undefined) ??
    (profile?.email
      ? roster.find((e) => !e.slackUserId && e.email && e.email.toLowerCase() === profile.email!.toLowerCase())
      : undefined);

  if (match) {
    return repo.updateEmployee(match.id, {
      slackUserId,
      email: match.email || profile?.email || '',
    });
  }
  // Create only if we could identify a real workspace member.
  if (profile) {
    return repo.createEmployee({
      userId: null,
      shiftId: null,
      slackUserId,
      name: profile.name || slackUserId,
      email: profile.email || '',
      status: 'active',
    });
  }
  return null;
}

export interface IncomingMessage {
  user: string;
  text: string;
  ts: string;
  channel?: string;
}

/**
 * Record one attendance message for a resolved workspace. Shared by the webhook
 * (push) and the poller (pull). Recording is silent — nothing is posted back to
 * the Slack channel.
 */
export async function recordMessage(
  workspace: SlackWorkspace,
  msg: IncomingMessage,
): Promise<ProcessResult> {
  const companyId = workspace.companyId;
  const intent = classifyIntent(msg.text ?? '');
  const repo = new TenantRepository(store, { companyId, crossTenant: false });
  const botToken = botTokenForWorkspace(workspace);

  const employee = await resolveEmployee(repo, companyId, botToken, msg.user);

  repo.createAttendanceEvent(companyId, {
    employeeId: employee?.id ?? null,
    slackUserId: msg.user,
    type: intent ?? 'check_in',
    rawText: msg.text ?? '',
    occurredAt: new Date(Number(msg.ts) * 1000).toISOString(),
  });

  if (!employee) return { companyId, employeeId: null, status: null, action: 'ignored_no_employee' };
  if (!intent) return { companyId, employeeId: employee.id, status: null, action: 'ignored_no_intent' };

  const date = dateFromTs(msg.ts);
  const time = hhmmFromTs(msg.ts);
  // Don't record attendance for a terminated employee on/after their termination
  // date — they no longer appear in the roster or attendance from that point.
  if (employee.status === 'terminated' && employee.terminatedAt && date >= employee.terminatedAt) {
    return { companyId, employeeId: employee.id, status: null, action: 'ignored_terminated' };
  }
  const rule = repo.upsertAttendanceRule({});
  const shift = employee.shiftId ? repo.getShift(employee.shiftId) : null;
  const existing = repo
    .listAttendance({ employeeId: employee.id, from: date, to: date })
    .find((r) => r.date === date);

  const checkIn = intent === 'check_in' ? time : existing?.checkIn ?? null;
  const checkOut = intent === 'check_out' ? time : existing?.checkOut ?? null;
  const status = computeStatus({ date, checkIn, checkOut, shift, rule });
  const record = repo.upsertAttendanceForDate({ employeeId: employee.id, date, checkIn, checkOut, status });

  // Attendance is recorded silently — we never post anything back to the Slack
  // channel (no confirmation replies), so #attendance stays clean.
  return { companyId, employeeId: employee.id, status: record.status, action: 'recorded' };
}

/** True for human messages we should process (skip bot posts, edits, joins). */
export function isProcessableMessage(m: { user?: string; subtype?: string; bot_id?: string }): boolean {
  return Boolean(m.user) && !m.bot_id && (!m.subtype || m.subtype === 'thread_broadcast');
}

/**
 * Resolve a Slack push event to its tenant and record attendance.
 * Slack event → slack_team_id → company → employee → attendance under company_id.
 */
export async function processSlackEvent(payload: SlackEvent): Promise<ProcessResult> {
  const workspace = [...store.slackWorkspaces.values()].find(
    (w) => w.slackTeamId === payload.team_id,
  );
  if (!workspace) {
    throw new NotFoundError('No company is associated with this Slack workspace');
  }
  const ev = payload.event;
  if (!isProcessableMessage(ev)) {
    return { companyId: workspace.companyId, employeeId: null, status: null, action: 'ignored_bot' };
  }
  return recordMessage(workspace, { user: ev.user, text: ev.text, ts: ev.ts, channel: ev.channel });
}
