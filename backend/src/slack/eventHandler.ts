import { store } from '../data/store';
import { TenantRepository } from '../data/repository';
import { computeStatus } from '../attendance/attendanceEngine';
import { NotFoundError } from '../errors';

export interface SlackEvent {
  team_id: string;
  event: {
    type: string;
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
  action: 'recorded' | 'ignored_no_employee' | 'ignored_no_intent';
}

/** "in"/"checking in" → check_in, "out"/"leaving" → check_out, else null. */
export function classifyIntent(text: string): 'check_in' | 'check_out' | null {
  const t = text.toLowerCase();
  if (/\b(in|checking in|check-in|checkin|clock in|start)\b/.test(t)) return 'check_in';
  if (/\b(out|checking out|check-out|checkout|clock out|leaving|done)\b/.test(t)) {
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
 * Resolve a Slack event to its tenant and record attendance.
 *
 * Slack event → slack_team_id → company → employee → attendance, stored under
 * company_id. An event whose team maps to no company is REJECTED — it is never
 * processed against a default or guessed tenant.
 */
export function processSlackEvent(payload: SlackEvent): ProcessResult {
  // Tenant resolution happens against the un-scoped store because we do not yet
  // have an authenticated principal — the team id IS the tenant credential.
  const workspace = [...store.slackWorkspaces.values()].find(
    (w) => w.slackTeamId === payload.team_id,
  );
  if (!workspace) {
    throw new NotFoundError('No company is associated with this Slack workspace');
  }
  const companyId = workspace.companyId;

  const intent = classifyIntent(payload.event.text ?? '');

  // Build a repository scoped to exactly this resolved tenant.
  const repo = new TenantRepository(store, { companyId, crossTenant: false });

  const employee = repo.findEmployeeBySlackUser(companyId, payload.event.user);

  // Always record the raw event under the correct company for auditing.
  repo.createAttendanceEvent(companyId, {
    employeeId: employee?.id ?? null,
    slackUserId: payload.event.user,
    type: intent ?? 'check_in',
    rawText: payload.event.text ?? '',
    occurredAt: new Date(Number(payload.event.ts) * 1000).toISOString(),
  });

  if (!employee) {
    return { companyId, employeeId: null, status: null, action: 'ignored_no_employee' };
  }
  if (!intent) {
    return { companyId, employeeId: employee.id, status: null, action: 'ignored_no_intent' };
  }

  const date = dateFromTs(payload.event.ts);
  const time = hhmmFromTs(payload.event.ts);
  const rule = repo.upsertAttendanceRule({}); // ensures a rule exists (defaults)
  const shift = employee.shiftId ? repo.getShift(employee.shiftId) : null;

  const existing = repo
    .listAttendance({ employeeId: employee.id, from: date, to: date })
    .find((r) => r.date === date);

  const checkIn = intent === 'check_in' ? time : existing?.checkIn ?? null;
  const checkOut = intent === 'check_out' ? time : existing?.checkOut ?? null;

  const status = computeStatus({ date, checkIn, checkOut, shift, rule });

  const record = repo.upsertAttendanceForDate({
    employeeId: employee.id,
    date,
    checkIn,
    checkOut,
    status,
  });

  return {
    companyId,
    employeeId: employee.id,
    status: record.status,
    action: 'recorded',
  };
}
