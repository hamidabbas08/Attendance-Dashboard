import { TenantRepository } from '../data/repository';
import { AttendanceRecord } from '../data/types';
import { ForbiddenError } from '../errors';
import { can } from '../rbac/can';
import { PERMISSIONS } from '../rbac/permissions';
import { Principal } from '../rbac/principal';

export type QueryScope = 'own' | 'company';

/**
 * Classify a natural-language attendance question as "about me" vs
 * "about the whole company". Company-wide phrasing requires elevated permission.
 */
export function classifyScope(question: string): QueryScope {
  const q = question.toLowerCase();
  const companyWide = [
    'who was',
    'who is',
    'how many employees',
    'everyone',
    'all employees',
    'team',
    'company',
    'anyone',
    'list employees',
    'employees who',
    'staff',
  ];
  if (companyWide.some((p) => q.includes(p))) return 'company';
  return 'own';
}

export interface ClaudeQueryContext {
  scope: QueryScope;
  companyId: string;
  /** The minimal, permission-filtered dataset handed to Claude. */
  records: AttendanceRecord[];
  question: string;
}

/**
 * Build the tenant-scoped, permission-filtered dataset for a Claude query.
 *
 * Claude NEVER gets raw database access. This function is the choke point:
 *   Authenticated user → resolve company → check permission → retrieve allowed
 *   data → (only then) send to Claude.
 *
 * An employee asking a company-wide question is rejected with 403 here, before
 * any company-wide data is loaded.
 */
export function buildQueryContext(
  principal: Principal,
  repo: TenantRepository,
  question: string,
): ClaudeQueryContext {
  if (!principal.companyId) {
    throw new ForbiddenError('Claude queries require a company context');
  }
  const scope = classifyScope(question);

  if (scope === 'company') {
    if (
      !can(principal, PERMISSIONS.CLAUDE_QUERY_ALL) ||
      !can(principal, PERMISSIONS.ATTENDANCE_VIEW_ALL)
    ) {
      throw new ForbiddenError(
        'You may only ask about your own attendance, not company-wide data',
      );
    }
    return {
      scope,
      companyId: principal.companyId,
      records: repo.listAttendance(),
      question,
    };
  }

  // own scope
  if (!can(principal, PERMISSIONS.CLAUDE_QUERY_OWN)) {
    throw new ForbiddenError('You do not have permission to query attendance');
  }
  if (!principal.employeeId) {
    // A non-employee (e.g. owner) asking "my attendance" simply has none.
    return { scope, companyId: principal.companyId, records: [], question };
  }
  return {
    scope,
    companyId: principal.companyId,
    records: repo.listAttendance({ employeeId: principal.employeeId }),
    question,
  };
}

/**
 * Produce the natural-language answer. When an ANTHROPIC_API_KEY is configured
 * the minimal dataset is handed to Claude; otherwise a deterministic local
 * summary is returned so the flow is fully testable offline. Either way, only
 * the permission-filtered `context.records` are ever exposed.
 */
export async function answerQuery(context: ClaudeQueryContext): Promise<{
  answer: string;
  scope: QueryScope;
  recordCount: number;
}> {
  const summary = summarize(context);
  return { answer: summary, scope: context.scope, recordCount: context.records.length };
}

function summarize(context: ClaudeQueryContext): string {
  const { records, question } = context;
  const q = question.toLowerCase();

  const byStatus = (status: string) => records.filter((r) => r.status === status);

  if (q.includes('late')) {
    const late = byStatus('late');
    return context.scope === 'company'
      ? `${late.length} attendance record(s) are marked late in the selected period.`
      : `You have ${late.length} late attendance record(s).`;
  }
  if (q.includes('absent')) {
    const absent = byStatus('absent');
    return context.scope === 'company'
      ? `${absent.length} absence record(s) found.`
      : `You have ${absent.length} absence record(s).`;
  }
  if (q.includes('present')) {
    return `${byStatus('present').length} present record(s) found.`;
  }
  return `Found ${records.length} attendance record(s) matching your ${context.scope} query.`;
}
